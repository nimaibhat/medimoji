
import Replicate from "replicate";
import fs from "node:fs";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});
const input = {
    prompt: "You are an intelligent medical illustration assistant. You help medical professionals create accurate, engaging medical illustrations and diagrams in cartoon/comic style. Default to comic/cartoon style with panels, boxes, and engaging visual elements. Always prioritize medical accuracy while making the content visually appealing and educational. Use the example image to base your image structure.`;",
    aspect_ratio: "16:9",
    output_format: "jpg",
    safety_filter_level: "block_medium_and_above"
  };
  
  const output = await replicate.run("google/imagen-4", { input });
  
  // To access the file URL:
  console.log(output.url()); //=> "http://example.com"
  
  // To write the file to disk:
  fs.writeFile("my-image.png", output);