/**
 * Rootstock Testnet Configuration
 * 
 * This module configures viem to connect to Rootstock testnet
 * and provides utilities for interacting with the PayPerAPI contract.
 * 
 * Rootstock is a Bitcoin-secured smart contract platform that's EVM-compatible,
 * making it perfect for Bitcoin-backed API payments via x402.
 */

import { createPublicClient, createWalletClient, custom, formatEther, parseEther } from 'viem';
import { defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dns from 'node:dns';
import fetch from 'node-fetch';
import https from 'node:https';
import dotenv from 'dotenv';

// Ensure env vars are available even when this module is imported
// before server.js calls dotenv.config() (ESM import evaluation order).
dotenv.config();

// WSL/undici can intermittently fail on dual-stack resolution for some RPC hosts.
// Force IPv4-first resolution process-wide for predictable RPC connectivity.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (error) {
  // Non-fatal: continue with system DNS order if unavailable.
}

/**
 * Rootstock Testnet Chain Definition
 * Chain ID: 31
 * Native currency: RBTC (Rootstock Bitcoin)
 */
export const rootstockTestnet = defineChain({
  id: 31,
  name: 'Rootstock Testnet',
  nativeCurrency: {
    name: 'Rootstock Bitcoin',
    symbol: 'RBTC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.ROOTSTOCK_TESTNET_RPC_URL || 'https://public-node.testnet.rsk.co'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Rootstock Explorer',
      url: 'https://explorer.testnet.rootstock.io',
    },
  },
});

const rpcUrl = process.env.ROOTSTOCK_TESTNET_RPC_URL || 'https://public-node.testnet.rsk.co';
const ipv4HttpsAgent = new https.Agent({ family: 4 });

async function rpcRequest(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
    agent: ipv4HttpsAgent,
  });

  const json = await response.json();
  if (json.error) {
    throw new Error(`RPC error (${json.error.code}): ${json.error.message}`);
  }

  return json.result;
}

const rpcTransport = custom({
  async request({ method, params }) {
    return rpcRequest(method, params);
  },
});

/**
 * Create a public client for reading from Rootstock testnet
 * This client is used to verify on-chain payments
 */
export const publicClient = createPublicClient({
  chain: rootstockTestnet,
  transport: rpcTransport,
});

/**
 * PayPerAPI Contract ABI
 * These are the functions we need to interact with the deployed contract
 */
export const payPerAPIContractABI = [
  {
    inputs: [],
    name: 'pay',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'payer', type: 'address' }],
    name: 'hasPaid',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'payer', type: 'address' }],
    name: 'getPaymentBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'payer', type: 'address' }],
    name: 'getAvailableRequests',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pricePerRequest',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'payer', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'deductPayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

/**
 * Contract address deployed on Rootstock testnet
 */
export const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || '0xa1F4D43749ABEdb6a835aF9184CD0A9c194d4C8a').toLowerCase();

const ownerPrivateKeyRaw = process.env.OWNER_PRIVATE_KEY || '';
const ownerPrivateKey = ownerPrivateKeyRaw
  ? (ownerPrivateKeyRaw.startsWith('0x') ? ownerPrivateKeyRaw : `0x${ownerPrivateKeyRaw}`)
  : null;

export const ownerAccount = ownerPrivateKey ? privateKeyToAccount(ownerPrivateKey) : null;

export const walletClient = ownerAccount
  ? createWalletClient({
      account: ownerAccount,
      chain: rootstockTestnet,
      transport: rpcTransport,
    })
  : null;

/**
 * Helper function to format RBTC amounts for display
 */
export const formatRBTC = (wei) => formatEther(BigInt(wei));

/**
 * Helper function to parse RBTC amounts
 */
export const parseRBTC = (rbtc) => parseEther(rbtc.toString());

