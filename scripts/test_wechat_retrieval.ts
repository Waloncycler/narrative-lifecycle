import { HttpResearchSourceRetriever } from '../src/features/research/io/research_source_retrieval_io';
import { readFileSync } from 'node:fs';

async function testWeChat() {
  const fetch = globalThis.fetch;
  
  try {
    // 宁德时代 凝聚态电池 微信文章
    const targetUrl = "https://mp.weixin.qq.com/s/s7pA2eN1v-2B60cK8QhD_A";
    console.log(`\nFound WeChat URL: ${targetUrl}`);
    
    // Read JINA API KEY from .env if it exists
    const env = readFileSync('.env', 'utf8');
    const jinaKey = env.split('\n').find(line => line.startsWith('JINA_API_KEY='))?.split('=')[1];
    if (jinaKey) process.env.JINA_API_KEY = jinaKey;
    
    console.log("Retrieving and parsing with HttpResearchSourceRetriever...");
    const retriever = new HttpResearchSourceRetriever(fetch);
    
    const result = await retriever.retrieve({ url: targetUrl, timeoutMs: 30000 });
    
    console.log("\n================ RETRIEVAL RESULT ================");
    console.log(`HTTP Status: ${result.httpStatus}`);
    console.log(`Content-Type: ${result.contentType}`);
    console.log(`\nBody Snippet (first 500 chars):\n`);
    console.log(result.body.substring(0, 500) + "\n...");
    console.log("==================================================");
    
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testWeChat();
