import { GameController } from "./controller.ts";
import { mount } from "./ui/app.ts";
import "./styles/app.css";
import "./styles/skins.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app");
}

mount(root, new GameController({ storage: localStorage }));
