import {config} from "./config.js";
import { v4 } from "uuid";

let api = config.api;
let apiKey = config.openai_api_key;
let model = config.model;
let temperature = config.temperature;
const sendMessage = async (message: string,conversationIds:string,parentMessageIds:string,oldReq:string,oldQue:string) => {
  const conversationId = conversationIds||v4(),
  parentMessageId = parentMessageIds||"",
  messageId = v4()
  const result = {
    role: "assistant",
    id: v4(),
    parentMessageId: messageId,
    conversationId,
    textNew: oldReq||""
  };
  let massages;
  try {
    if(oldQue.length>0){
      massages = [
        {"role": "system",
         "content": "You are a helpful assistant."
        },{
          "role": "user",
          "content": oldQue,
        },{
          "role": "assistant",
          "content":result.textNew
        },{
          "role": "user",
          "content": message,
        }
      ];
    }else{
      massages = [
        {"role": "system",
         "content": "You are a helpful assistant."
        },{
          "role": "assistant",
          "content":result.textNew
        },{
          "role": "user",
          "content": message,
        }
      ];
    }
    const response = await fetch(`${api}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: massages,
        temperature: temperature,
        top_p: 1,
        frequency_penalty: 0.0,
        presence_penalty: 0.6,
      }),
    }).then((res) => res.json());
    console.log("////////////////////");
    console.log("response:",response);
    console.log("////////////////////");
    if (response.error?.message) {
      console.log("OpenAI API ERROR: ",response.error.message)
      // throw new Error(`OpenAI API ${response.error.message}`);
    }
    result.id = response.id;
    result.textNew = response.choices[0].message.content;
    return result;
  } catch (e) {
    console.error(e)
    result.textNew = "请稍后重试！"
    return result
  }
}

export {sendMessage};

