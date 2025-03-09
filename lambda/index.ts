import { 
  BedrockRuntimeClient, 
  InvokeModelWithResponseStreamCommand
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: "us-east-1",
 });

export const handler = async (event: any) => {
  const prompt = " Create me an article about amazon bedrock"
  const claudePrompt = `\n\nHuman: ${prompt}\n\nAssistant:`

  const body = {
    prompt: claudePrompt,
    max_tokens_to_sample: 2048,
    temperature: 0.5,
    top_p: 0.5,
    stop_sequences: [],
  }

  const params = {
    modelId: "anthropic.claude-v2",
    stream: true,
    contentType: "application/json",
    accept: "*/*",
    body: JSON.stringify(body),
  }

  console.log(params);


  try {
    const command = new InvokeModelWithResponseStreamCommand(params);
    const response = await client.send(command);
    const chunks: string[] = [];

    for await (const chunk of response.body as AsyncIterable<{ chunk: { bytes: Uint8Array } }>) {
      const parsed = JSON.parse(
        Buffer.from(chunk.chunk.bytes).toString('utf-8')
      );

      chunks.push(parsed.completion);
      await publishMessage(parsed.completion);
    }
  } catch (error) {
    console.log(error);
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello, world!' }),
  };
};

const publishMessage = async (message: string) => {
  const payload = {
    message
  }

  try {
    await fetch(`https://4gndr4ibozhrjh4f64qdudsyhu.appsync-api.ap-southeast-1.amazonaws.com/event`, {
      method: "POST",
      headers: {
      "content-type": "application/json",
      "x-api-key": "da2-wpiudi2aufhalbaw3r2fx632ie",
    },
    body: JSON.stringify({
        channel: "default/bedrock-test",
        events: [JSON.stringify(payload)]
      })
    });
  } catch (error) {
    console.log(error);
  }
}