import { createRoot } from "react-dom/client"
import "@fontsource/nunito/600.css"
import "@fontsource/nunito/700.css"
import "@fontsource/nunito/800.css"
import "@fontsource/fraunces/600.css"
import "@fontsource/fraunces/700.css"
import "@fontsource/unifrakturmaguntia/400.css"
import "./styles.css"
import { App } from "./App"

createRoot(document.getElementById("root")!).render(<App />)
