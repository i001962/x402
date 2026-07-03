import crypto from "node:crypto";
import { x402Facilitator } from "@x402/core/facilitator";
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import dotenv from "dotenv";
import express from "express";
import { createWalletClient, http, nonceManager, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

dotenv.config();

const port = Number(process.env.PORT || "4022");
const evmNetwork = (process.env.EVM_NETWORK || "eip155:84532") as Network;
const evmRpcUrl = process.env.EVM_RPC_URL;
const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}` | undefined;
const authToken = process.env.FACILITATOR_AUTH_TOKEN;

if (!evmPrivateKey) {
  console.error("EVM_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

if (!evmRpcUrl) {
  console.error("EVM_RPC_URL environment variable is required");
  process.exit(1);
}

if (!authToken) {
  console.error("FACILITATOR_AUTH_TOKEN environment variable is required");
  process.exit(1);
}

const chain = (() => {
  switch (evmNetwork) {
    case "eip155:8453":
      return base;
    case "eip155:84532":
      return baseSepolia;
    default:
      console.error(`Unsupported EVM_NETWORK: ${evmNetwork}. Use eip155:8453 or eip155:84532.`);
      process.exit(1);
  }
})();

function isAuthorized(header: string | undefined): boolean {
  if (!header?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(header.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(authToken as string, "utf8");

  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

const account = privateKeyToAccount(evmPrivateKey, { nonceManager });
const viemClient = createWalletClient({
  account,
  chain,
  transport: http(evmRpcUrl),
}).extend(publicActions);

const evmSigner = toFacilitatorEvmSigner({
  address: account.address,
  getCode: args => viemClient.getCode(args),
  readContract: args =>
    viemClient.readContract({
      ...args,
      args: args.args ?? [],
    } as Parameters<typeof viemClient.readContract>[0]),
  verifyTypedData: args =>
    viemClient.verifyTypedData(args as Parameters<typeof viemClient.verifyTypedData>[0]),
  writeContract: args =>
    viemClient.writeContract(args as Parameters<typeof viemClient.writeContract>[0]),
  sendTransaction: args =>
    viemClient.sendTransaction(args as Parameters<typeof viemClient.sendTransaction>[0]),
  waitForTransactionReceipt: args => viemClient.waitForTransactionReceipt(args),
});

const facilitator = new x402Facilitator();
facilitator.register(evmNetwork, new ExactEvmScheme(evmSigner));

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, network: evmNetwork });
});

app.use((req, res, next) => {
  if (isAuthorized(req.header("authorization"))) {
    next();
    return;
  }

  res.status(401).json({ error: "unauthorized" });
});

app.get("/supported", (_req, res) => {
  res.json(facilitator.getSupported());
});

app.post("/verify", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload?: PaymentPayload;
      paymentRequirements?: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      res.status(400).json({ error: "Missing paymentPayload or paymentRequirements" });
      return;
    }

    const response: VerifyResponse = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(response);
  } catch (error) {
    console.error("verify failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/settle", async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload?: PaymentPayload;
      paymentRequirements?: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      res.status(400).json({ error: "Missing paymentPayload or paymentRequirements" });
      return;
    }

    const response: SettleResponse = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(response);
  } catch (error) {
    console.error("settle failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.listen(port, () => {
  console.info(`x402 Base facilitator listening on :${port}`);
  console.info(`network=${evmNetwork}`);
  console.info(`facilitator=${account.address}`);
});
