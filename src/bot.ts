import { config } from "./config.js";
import { ContactInterface, RoomInterface } from "wechaty/impls";
import { Message } from "wechaty";
import {sendMessage} from "./chatgpt.js";
let chatOption = {};
enum MessageType {
  Unknown = 0,

  Attachment = 1, // Attach(6),
  Audio = 2, // Audio(1), Voice(34)
  Contact = 3, // ShareCard(42)
  ChatHistory = 4, // ChatHistory(19)
  Emoticon = 5, // Sticker: Emoticon(15), Emoticon(47)
  Image = 6, // Img(2), Image(3)
  Text = 7, // Text(1)
  Location = 8, // Location(48)
  MiniProgram = 9, // MiniProgram(33)
  GroupNote = 10, // GroupNote(53)
  Transfer = 11, // Transfers(2000)
  RedEnvelope = 12, // RedEnvelopes(2001)
  Recalled = 13, // Recalled(10002)
  Url = 14, // Url(5)
  Video = 15, // Video(4), Video(43)
  Post = 16, // Moment, Channel, Tweet, etc
}

const SINGLE_MESSAGE_MAX_SIZE = 500;
export class ChatGPTBot {
  chatPrivateTiggerKeyword = config.chatPrivateTiggerKeyword;
  chatTiggerRule = config.chatTiggerRule? new RegExp(config.chatTiggerRule): undefined;
  disableGroupMessage = config.disableGroupMessage || false;
  botName: string = "";
  ready = false;
  setBotName(botName: string) {
    this.botName = botName;
  }
  get chatGroupTiggerRegEx(): RegExp {
    return new RegExp(`^@${this.botName}\\s`);
  }
  get chatPrivateTiggerRule(): RegExp | undefined {
    const { chatPrivateTiggerKeyword, chatTiggerRule } = this;
    let regEx = chatTiggerRule
    if (!regEx && chatPrivateTiggerKeyword) {
      regEx = new RegExp(chatPrivateTiggerKeyword)
    }
    return regEx
  }
  async command(): Promise<void> {}
  // remove more times conversation and mention
  cleanMessage(rawText: string, privateChat: boolean = false): string {
    let text = rawText;
    const item = rawText.split("- - - - - - - - - - - - - - -");
    if (item.length > 1) {
      text = item[item.length - 1];
    }
    
    const { chatTiggerRule, chatPrivateTiggerRule } = this;
    
    if (privateChat && chatPrivateTiggerRule) {
      text = text.replace(chatPrivateTiggerRule, "")
    } else if (!privateChat) {
      text = text.replace(this.chatGroupTiggerRegEx, "")
      text = chatTiggerRule? text.replace(chatTiggerRule, ""): text
    }
    // remove more text via - - - - - - - - - - - - - - -
    return text
  }
  async getGPTMessage(text: string,userId:string): Promise<string> {
    const { conversationId, textNew, id } = await sendMessage(text,chatOption[userId].conversationIds,chatOption[userId].conversationIds,chatOption[userId].oldText)
    chatOption = {
      [userId]: {
        conversationId,
        parentMessageId: id,
        oldText:textNew
      },
    };
    console.log("chatOption",chatOption);
    return textNew
  }
  // Check if the message returned by chatgpt contains masked words]
  checkChatGPTBlockWords(message: string): boolean {
    if (config.chatgptBlockWords.length == 0) {
      return false;
    }
    return config.chatgptBlockWords.some((word) => message.includes(word));
  }
  // The message is segmented according to its size
  async trySay(
    talker: RoomInterface | ContactInterface,
    mesasge: string
  ): Promise<void> {
    const messages: Array<string> = [];
    if (this.checkChatGPTBlockWords(mesasge)) {
      console.log(`🚫 Blocked ChatGPT: ${mesasge}`);
      return;
    }
    let message = mesasge;
    while (message.length > SINGLE_MESSAGE_MAX_SIZE) {
      messages.push(message.slice(0, SINGLE_MESSAGE_MAX_SIZE));
      message = message.slice(SINGLE_MESSAGE_MAX_SIZE);
    }
    messages.push(message);
    for (const msg of messages) {
      await talker.say(msg);
    }
  }
  // Check whether the ChatGPT processing can be triggered
  tiggerGPTMessage(text: string, privateChat: boolean = false): boolean {
    const { chatTiggerRule } = this;
    let triggered = false;
    if (privateChat) {
      const regEx = this.chatPrivateTiggerRule
      triggered = regEx? regEx.test(text): true;
    } else {
      triggered = this.chatGroupTiggerRegEx.test(text);
      // group message support `chatTiggerRule`
      if (triggered && chatTiggerRule) {
        triggered = chatTiggerRule.test(text.replace(this.chatGroupTiggerRegEx, ""))
      }
    }
    if (triggered) {
      console.log(`🎯 Triggered ChatGPT: ${text}`);
    }
    return triggered;
  }
  // Check whether the message contains the blocked words. if so, the message will be ignored. if so, return true
  checkBlockWords(message: string): boolean {
    if (config.blockWords.length == 0) {
      return false;
    }
    return config.blockWords.some((word) => message.includes(word));
  }
  // Filter out the message that does not need to be processed
  isNonsense(
    talker: ContactInterface,
    messageType: MessageType,
    text: string
  ): boolean {
    return (
      talker.self() ||
      // TODO: add doc support
      messageType !== MessageType.Text ||
      talker.name() === "微信团队" ||
      // 语音(视频)消息
      text.includes("收到一条视频/语音聊天消息，请在手机上查看") ||
      // 红包消息
      text.includes("收到红包，请在手机上查看") ||
      // Transfer message
      text.includes("收到转账，请在手机上查看") ||
      // 位置消息
      text.includes("/cgi-bin/mmwebwx-bin/webwxgetpubliclinkimg") ||
      // 聊天屏蔽词
      this.checkBlockWords(text)
    );
  }

  async onPrivateMessage(talker: ContactInterface, text: string) {
    const gptMessage = await this.getGPTMessage(text,talker.id);
    await this.trySay(talker, gptMessage);
  }

  async onGroupMessage(
    talker: ContactInterface,
    text: string,
    room: RoomInterface
  ) {
    const gptMessage = await this.getGPTMessage(text,talker.id);
    const result = `@${talker.name()} ${text}\n\n------ ${gptMessage}`;
    await this.trySay(room, result);
  }
  async onMessage(message: Message) {
    console.log(`🎯 ${message.date()} Message: ${message}`);
    const talker = message.talker();
    const rawText = message.text();
    const room = message.room();
    const messageType = message.type();
    const privateChat = !room;
    if (this.isNonsense(talker, messageType, rawText)) {
      return;
    }
    if (this.tiggerGPTMessage(rawText, privateChat)) {
      const text = this.cleanMessage(rawText, privateChat);
      if (privateChat) {
        return await this.onPrivateMessage(talker, text);
      } else{
        if (!this.disableGroupMessage){
          return await this.onGroupMessage(talker, text, room);
        } else {
          return;
        }
      }
    } else {
      return;
    }
  }
}