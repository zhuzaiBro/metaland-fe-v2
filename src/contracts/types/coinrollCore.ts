/**
 * CoinRollCore Contract Types
 * Following the smart contract integration standard
 */

import { Address, Hash, Hex } from 'viem'

// ============================================================================
// Enums
// ============================================================================

export enum TokenStatus {
  NONE = 0,
  TRADING = 1,
  PAUSED = 2,
  GRADUATED = 3,
  BLACKLISTED = 4,
}

// ============================================================================
// Core Structures
// ============================================================================

export interface TokenInfo {
  creator: Address
  createdAt: bigint
  launchTime: bigint
  status: TokenStatus
  liquidityPool: Address
  useV3: boolean
}

export interface BondingCurveParams {
  virtualBNBReserve: bigint
  virtualTokenReserve: bigint
  k: bigint
  availableTokens: bigint
  collectedBNB: bigint
}

// ============================================================================
// Function Parameters
// ============================================================================

/**
 * Parameters for calculateInitialBuyBNB function
 */
export interface CalculateInitialBuyBNBParams {
  saleAmount: bigint | string // Token amount for sale
  virtualBNBReserve: bigint | string // Virtual BNB reserve
  virtualTokenReserve: bigint | string // Virtual token reserve
  percentageBP: number // Percentage in basis points (e.g., 100 = 1%)
}

/**
 * Parameters for createToken function
 */
export interface CreateTokenParams {
  // Token basic info
  name: string
  symbol: string
  totalSupply: string // Will be converted to bigint

  // Bonding curve parameters
  virtualBNBReserve?: string // Optional, defaults from contract
  virtualTokenReserve?: string // Optional, defaults from contract

  // Initial buy parameters (optional)
  initialBuyPercentageBP?: number // Percentage in basis points (0-1000)

  // Meta information
  requestId: string // Unique request ID
  timestamp: number // Request timestamp
  creator: Address // Creator address

  // Additional metadata (optional)
  metadata?: {
    description?: string
    website?: string
    twitter?: string
    telegram?: string
    discord?: string
    logo?: string
  }
}

/**
 * Raw data structure for createToken signature
 */
export interface CreateTokenData {
  requestId: string
  timestamp: number
  creator: Address
  name: string
  symbol: string
  totalSupply: bigint
  virtualBNBReserve: bigint
  virtualTokenReserve: bigint
  initialBuyPercentageBP: number
  metadata?: string // JSON stringified metadata
}

// ============================================================================
// Transaction Results
// ============================================================================

export interface CreateTokenResult {
  hash: Hash
  tokenAddress?: Address // Parsed from event logs
  requestId: string
  timestamp: number
}

export interface CalculateInitialBuyResult {
  bnbRequired: bigint
  bnbRequiredFormatted: string
  priceImpact: number // Percentage
  tokensReceived: bigint
  tokensReceivedFormatted: string
}

// ============================================================================
// Event Types
// ============================================================================

export interface TokenCreatedEvent {
  token: Address
  creator: Address
  name: string
  symbol: string
  totalSupply: bigint
  requestId: Hex
  transactionHash: Hash
  blockNumber: bigint
}

export interface TokenCreatedWithInitialBuyEvent {
  token: Address
  creator: Address
  initialTokensPurchased: bigint
  initialBNBSpent: bigint
  actualPercentage: bigint
  transactionHash: Hash
  blockNumber: bigint
}

export interface TokenBoughtEvent {
  token: Address
  buyer: Address
  bnbAmount: bigint
  tokenAmount: bigint
  transactionHash: Hash
  blockNumber: bigint
}

export interface TokenSoldEvent {
  token: Address
  seller: Address
  tokenAmount: bigint
  bnbAmount: bigint
  transactionHash: Hash
  blockNumber: bigint
}

export interface TokenGraduatedEvent {
  token: Address
  liquidityBNB: bigint
  liquidityTokens: bigint
  transactionHash: Hash
  blockNumber: bigint
}

// ============================================================================
// Helper Types
// ============================================================================

export interface TokenMetrics {
  marketCap: bigint
  price: bigint // Price per token in wei
  holders: number
  volume24h: bigint
  priceChange24h: number
  bondingProgress: number // Percentage (0-100)
}

export interface GasEstimate {
  gasLimit: bigint
  gasPrice: bigint
  totalCostBNB: bigint
  totalCostFormatted: string
}

// ============================================================================
// Error Types
// ============================================================================

export interface CoinRollCoreError {
  code: string
  message: string
  details?: any
}

export const ERROR_CODES = {
  INSUFFICIENT_BALANCE: 'InsufficientBalance',
  INSUFFICIENT_FEE: 'InsufficientFee',
  INSUFFICIENT_MARGIN: 'InsufficientMargin',
  INVALID_PARAMETERS: 'InvalidParameters',
  INVALID_SIGNER: 'InvalidSigner',
  INVALID_STATUS: 'InvalidStatus',
  REQUEST_ALREADY_PROCESSED: 'RequestAlreadyProcessed',
  REQUEST_EXPIRED: 'RequestExpired',
  SLIPPAGE_EXCEEDED: 'SlippageExceeded',
  TOKEN_NOT_TRADING: 'TokenNotTrading',
  TRANSACTION_EXPIRED: 'TransactionExpired',
  UNAUTHORIZED: 'Unauthorized',
  PAUSED: 'EnforcedPause',
} as const

// ============================================================================
// Constants
// ============================================================================

export const COINROLL_CORE_CONSTANTS = {
  // Fee rates (in basis points)
  PLATFORM_FEE_RATE: 300, // 3%
  CREATOR_FEE_RATE: 200, // 2%

  // Limits
  MAX_INITIAL_BUY_PERCENTAGE: 1000, // 10% max initial buy
  MIN_REMAINING_PERCENTAGE: 9000, // 90% must remain
  MIN_LIQUIDITY: BigInt('1000000000000000000'), // 1 BNB minimum
  DEFAULT_SALE_AMOUNT: BigInt('996000000000000000000000000'), // 1M tokens

  // Timing
  REQUEST_EXPIRY: 300, // 5 minutes in seconds

  // Default bonding curve parameters
  DEFAULT_VIRTUAL_BNB_RESERVE: BigInt('8219178082191780000'), // 1 BNB
  DEFAULT_VIRTUAL_TOKEN_RESERVE: BigInt('1073972602739720000000000000'), // 1M tokens
} as const

// ============================================================================
// Utility Type Guards
// ============================================================================

export function isTokenStatus(value: any): value is TokenStatus {
  return Object.values(TokenStatus).includes(value)
}

export function isValidPercentageBP(value: number): boolean {
  return value >= 0 && value <= 10000 // 0-100%
}

export function isValidInitialBuyPercentage(value: number): boolean {
  return (
    value >= 0 && value <= COINROLL_CORE_CONSTANTS.MAX_INITIAL_BUY_PERCENTAGE
  )
}
