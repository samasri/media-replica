import express, {
  Request,
  Response,
  static as staticMw,
  urlencoded as urlencodedMw,
} from "express";
import { copyFileSync, existsSync, mkdirSync, rmSync, rmdirSync } from "fs";
import { join, basename } from "path";

const hostedUrl = "http://192.168.0.103";
const port = 3000; // TODO make configurable

type MediaType = "image" | "video";

const mediaElement = (name: string, type: MediaType) =>
  type === "image"
    ? `<img src="/images/${name}" style="width: 100%;">`
    : `<video src="/images/${name}" style="width: 100%;" controls></video>`;

const imgChoiceHtml = (imgName: string, path: string, type: MediaType) => `
<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; width: 600px;">
  <div style="flex: 1;">
    <a href="${`/images/${imgName}`}">
      ${mediaElement(imgName, type)}
    </a>
  </div>
  <div style="flex: 1; text-align: center;">
    <label>${imgName}</label>
  </div>
  <div style="flex: 1; text-align: center; display: flex; gap: 10px; justify-content: center;">
    <label style="display: inline-flex; align-items: center; padding: 12px 24px; background: #4CAF50; color: white; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">
      <input type="radio" name="${path}" value="yes" checked style="width: 20px; height: 20px; margin-right: 8px;"> Yes
    </label>
    <label style="display: inline-flex; align-items: center; padding: 12px 24px; background: #f44336; color: white; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold;">
      <input type="radio" name="${path}" value="no" style="width: 20px; height: 20px; margin-right: 8px;"> No
    </label>
  </div>
</div>
`;

const showImages = async (
  srcDir: string,
  images: string[],
  type: MediaType = "image"
): Promise<string[]> => {
  const tempDir = join(__dirname, "temp_images");
  if (!existsSync(tempDir)) mkdirSync(tempDir);

  const copiedImages = images.map((image) => {
    const srcPath = join(srcDir, image);
    const dstPath = join(tempDir, basename(image)); // Extract names from images that are received as a relative path such as "Sent/IMG-20240312-WA0004.jpg"

    copyFileSync(srcPath, dstPath);
    return {
      path: image,
      name: basename(image),
    };
  });

  const app = express();

  app.get("/", (_: Request, res: Response) => {
    let html = '<form action="/submit" method="post">';
    copiedImages.forEach(
      (image) => (html += imgChoiceHtml(image.name, image.path, type))
    );
    html += '<button type="submit">Submit</button></form>';
    res.send(html);
  });

  app.use("/images", staticMw(tempDir));

  app.use(urlencodedMw({ extended: true }));

  return new Promise<string[]>((resolve) => {
    app.post("/submit", (req: Request, res: Response) => {
      const selectedImages: string[] = [];
      for (const [key, value] of Object.entries(req.body))
        if (value === "yes") selectedImages.push(key);

      res.send("Thank you for your selection!");
      server.close(() => {
        console.log("Server closed");
        rmSync(tempDir, { recursive: true });
        resolve(selectedImages);
      });
    });

    const server = app.listen(port, () => {
      console.log(`Go to ${hostedUrl}:${port} to continue`); // TODO: make this hostname configurable
    });
  });
};

export default showImages;
export type { MediaType };
