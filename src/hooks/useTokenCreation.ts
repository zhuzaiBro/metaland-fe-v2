/**
 * Token creation business logic hook
 * Handles API calls and contract interactions
 * No UI concerns, just pure business logic
 */

import { useState, useCallback } from 'react'
import { type Hex, parseEther, decodeAbiParameters } from 'viem'
import { useCreateToken } from '@/api/endpoints/tokens'
import { useCreateTokenContract } from '@/contracts/hooks/coinrollCore'
import { calculateInitialBuyBNBDirect } from '@/contracts/hooks/coinrollCore/useCalculateInitialBuyBNB'
import { COINROLL_CORE_CONSTANTS } from '@/contracts/types/coinrollCore'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { LaunchMode } from '@/types/token'

export interface TokenCreationData {
  // Basic token info
  name: string
  symbol: string
  description?: string

  // Launch configuration
  launchMode: LaunchMode | string // Can be either type for flexibility
  launchTime: number // Required, defaults to 0

  // Media URLs
  logo: string
  banner?: string

  // Social links
  website?: string
  twitter?: string
  telegram?: string
  discord?: string
  whitepaper?: string

  // Tags
  tags?: string[]

  // Financial parameters (required with defaults)
  preBuyPercent: number // Defaults to 0
  marginBnb: number // Defaults to 0
  marginTime: number // Defaults to 0

  // Contract address customization
  predictedAddress?: string
  digits?: string

  // Official contact information
  contractTg?: string
  contractEmail?: string

  // PreBuy utility allocation (arrays must be same length)
  preBuyUsedPercent?: number[]
  preBuyUsedType?: number[]
  preBuyLockTime?: number[]
  preBuyUsedName?: string[]
  preBuyUsedDesc?: string[]
}

export interface TokenCreationResult {
  createToken: (data: TokenCreationData) => Promise<CreateTokenResult | null>
  isCreating: boolean
  error: Error | null
  reset: () => void
}

export interface CreateTokenResult {
  transactionHash: Hex
  predictedAddress?: string
  tokenAddress?: string
}

/**
 * Hook for token creation business logic
 * Handles API call to get parameters and contract execution
 * Returns transaction hash for monitoring
 */
export function useTokenCreation(): TokenCreationResult {
  const t = useTranslations()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // API and contract hooks
  const createTokenMutation = useCreateToken()
  const createTokenContract = useCreateTokenContract()

  /**
   * Create token through API and contract
   */
  const createToken = useCallback(
    async (data: TokenCreationData): Promise<CreateTokenResult | null> => {
      setIsCreating(true)
      setError(null)

      try {
        // Step 1: Call API to get contract parameters
        // Convert launchMode string to LaunchMode number if needed
        const apiData = {
          ...data,
          launchMode:
            typeof data.launchMode === 'string'
              ? (parseInt(data.launchMode, 10) as LaunchMode)
              : (data.launchMode as LaunchMode),
        }
        console.log('Calling API with data:', apiData)
        const apiResult = await createTokenMutation.mutateAsync(apiData)

        if (!apiResult.data?.createArg || !apiResult.data?.signature) {
          throw new Error('API did not return contract parameters')
        }

        const { createArg, signature, predictedAddress } = apiResult.data

        // Decode the createArg to extract bonding curve parameters
        // The createArg contains encoded parameters including bonding curve values
        let saleAmount = COINROLL_CORE_CONSTANTS.DEFAULT_SALE_AMOUNT
        let virtualBNBReserve =
          COINROLL_CORE_CONSTANTS.DEFAULT_VIRTUAL_BNB_RESERVE
        let virtualTokenReserve =
          COINROLL_CORE_CONSTANTS.DEFAULT_VIRTUAL_TOKEN_RESERVE

        try {
          // Attempt to decode createArg to extract actual parameters
          // The structure should match the contract's createToken function parameters
          // This is a simplified decode - actual structure depends on contract encoding
          const decoded = decodeAbiParameters(
            [
              { name: 'requestId', type: 'bytes32' },
              { name: 'timestamp', type: 'uint256' },
              { name: 'creator', type: 'address' },
              { name: 'name', type: 'string' },
              { name: 'symbol', type: 'string' },
              { name: 'totalSupply', type: 'uint256' },
              { name: 'virtualBNBReserve', type: 'uint256' },
              { name: 'virtualTokenReserve', type: 'uint256' },
              { name: 'saleAmount', type: 'uint256' },
              { name: 'initialBuyPercentageBP', type: 'uint256' },
            ],
            createArg as Hex
          )

          // Use decoded values if available
          if (decoded[6]) virtualBNBReserve = decoded[6] as bigint
          if (decoded[7]) virtualTokenReserve = decoded[7] as bigint
          if (decoded[8]) saleAmount = decoded[8] as bigint

          console.log('Decoded bonding curve parameters:', {
            virtualBNBReserve: virtualBNBReserve.toString(),
            virtualTokenReserve: virtualTokenReserve.toString(),
            saleAmount: saleAmount.toString(),
          })
        } catch (err) {
          // If decoding fails, use default values (already set above)
          console.log(
            'Using default bonding curve parameters (decode failed):',
            err
          )
        }

        // Calculate total BNB value needed for prebuy and margin
        let bnbValue = BigInt(0)
        let prebuyBNB = BigInt(0)
        let marginBNB = BigInt(0)

        // Calculate prebuy BNB if specified
        if (data.preBuyPercent && data.preBuyPercent > 0) {
          // preBuyPercent is already a decimal (0-1), convert to basis points
          // e.g., 0.1 = 10% = 1000 BP
          const percentageBP = Math.round(data.preBuyPercent * 10000)

          // Calculate required BNB using the actual bonding curve parameters
          const calculationResult = calculateInitialBuyBNBDirect({
            saleAmount,
            virtualBNBReserve,
            virtualTokenReserve,
            percentageBP,
          })

          prebuyBNB = calculationResult.bnbRequired
          bnbValue += prebuyBNB

          console.log(
            `Prebuy enabled: ${data.preBuyPercent * 100}% requires ${calculationResult.bnbRequiredFormatted} BNB`
          )
        }

        // Add margin BNB if specified
        if (data.marginBnb && data.marginBnb > 0) {
          marginBNB = parseEther(data.marginBnb.toString())
          bnbValue += marginBNB

          console.log(
            `Margin enabled: ${data.marginBnb} BNB for ${data.marginTime / (24 * 60 * 60)} days`
          )
        }

        // Step 2: Execute contract transaction
        console.log(
          'Executing contract transaction with total value:',
          bnbValue.toString(),
          `(Prebuy: ${prebuyBNB.toString()}, Margin: ${marginBNB.toString()})`
        )
        const contractResult = await createTokenContract.createToken({
          createArg: createArg as Hex,
          signature: signature as Hex,
          value: bnbValue, // Pass total BNB value for prebuy and margin
          valueBreakdown: {
            prebuy: prebuyBNB,
            margin: marginBNB,
          },
        })

        // If user cancelled or error occurred, contractResult will be null
        if (!contractResult) {
          setIsCreating(false)
          return null
        }

        console.log('Transaction submitted:', contractResult.hash)

        // Return transaction details for monitoring
        return {
          transactionHash: contractResult.hash,
          predictedAddress,
          tokenAddress: contractResult.tokenAddress,
        }
      } catch (err) {
        const error = err as Error
        setError(error)

        // Handle specific error cases
        if (
          error.message.includes('User rejected') ||
          error.message.includes('User denied')
        ) {
          toast.error(t('createToken.errors.transactionCancelled'), {
            description: t('createToken.errors.userCancelled'),
          })
        } else if (!error.message.includes('notify')) {
          // Only show error if not already handled
          toast.error(t('createToken.errors.creationFailed'), {
            description: error.message || t('createToken.errors.unexpected'),
          })
        }

        return null
      } finally {
        setIsCreating(false)
      }
    },
    [createTokenMutation, createTokenContract, t]
  )

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsCreating(false)
    setError(null)
  }, [])

  return {
    createToken,
    isCreating,
    error,
    reset,
  }
}
