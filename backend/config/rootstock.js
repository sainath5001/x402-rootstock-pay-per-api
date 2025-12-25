/**
 * Rootstock Testnet Configuration
 * 
 * This module configures viem to connect to Rootstock testnet
 * and provides utilities for interacting with the PayPerAPI contract.
 * 
 * Rootstock is a Bitcoin-secured smart contract platform that's EVM-compatible,
 * making it perfect for Bitcoin-backed API payments via x402.
 */

import { createPublicClient, http, formatEther, parseEther } from 'viem';
import { defineChain } from 'viem';

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

/**
 * Create a public client for reading from Rootstock testnet
 * This client is used to verify on-chain payments
 */
export const publicClient = createPublicClient({
  chain: rootstockTestnet,
  transport: http(process.env.ROOTSTOCK_TESTNET_RPC_URL || 'https://public-node.testnet.rsk.co'),
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
];

/**
 * Contract address deployed on Rootstock testnet
 */
export const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || '0xa1F4D43749ABEdb6a835aF9184CD0A9c194d4C8a').toLowerCase();

/**
 * Helper function to format RBTC amounts for display
 */
export const formatRBTC = (wei) => formatEther(BigInt(wei));

/**
 * Helper function to parse RBTC amounts
 */
export const parseRBTC = (rbtc) => parseEther(rbtc.toString());

