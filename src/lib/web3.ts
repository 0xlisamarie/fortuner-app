import "@rainbow-me/rainbowkit/styles.css";
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { polygon, polygonAmoy } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const customPolygonAmoy = {
  ...polygonAmoy,
  rpcUrls: {
    default: { http: ["https://rpc-amoy.polygon.technology/"] },
    public: { http: ["https://rpc-amoy.polygon.technology/"] },
  },
} as const;

export const config = getDefaultConfig({
  appName: "Fortune App",
  projectId: "YOUR_PROJECT_ID",
  chains: [polygon, customPolygonAmoy],
  ssr: true,
});

export const queryClient = new QueryClient();

const customDarkTheme = darkTheme({
  accentColor: "#ff8c00", // Our orange-primary
  accentColorForeground: "white",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

export {
  WagmiProvider,
  RainbowKitProvider,
  customDarkTheme as darkTheme,
  polygon,
  polygonAmoy,
  QueryClientProvider,
};
