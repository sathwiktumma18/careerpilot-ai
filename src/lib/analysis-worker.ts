import { generateAnalysis } from "./analysis-generator";

self.onmessage = (event: MessageEvent<{ id: string; fileName: string }>) => {
  const { id, fileName } = event.data;
  const analysis = generateAnalysis(id, fileName);
  postMessage({ analysis });
};
