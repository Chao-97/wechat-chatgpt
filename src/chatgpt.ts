import {config} from "./config.js";

let api = config.api;
let apiKey = config.openai_api_key;
let model = config.model;
let temperature = config.temperature;
const sendMessage = async (message: string) => {
  try {
    const response = await fetch(`${api}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 150,
        messages: [
          {"role": "system", "content": "You are a helpful assistant."},
          {
            "role": "user",
            "content": message
          }
        ],
        temperature: temperature,
        top_p: 1,
        frequency_penalty: 0.0,
        presence_penalty: 0.6,
      }),
    }).then((res) => res.json());

    if (response.error?.message) {
      console.log("OpenAI API ERROR: ",response.error.message)
      // throw new Error(`OpenAI API ${response.error.message}`);
    }
    return response.choices[0].message.content;
  } catch (e) {
    console.error(e)
    return "Something went wrong"
  }
}

export {sendMessage};