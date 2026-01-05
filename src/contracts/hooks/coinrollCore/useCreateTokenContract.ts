/**
 * Hook for calling the CoinRollCore contract's createToken method
 * Uses the createArg and signature from the API response
 */

import { useCallback, useState } from 'react'
import {
  useChainId,
  useAccount,
  usePublicClient,
  useWalletClient,
  useBalance,
} from 'wagmi'
import { Address, Hex } from 'viem'
import { toast } from 'sonner'
import CoinRollCoreABI from '@/contracts/abis/CoinRollCore.json'
import { getCoinRollCoreAddress } from '@/contracts/addresses'
import { handleContractError } from '@/contracts/utils/errors'

export interface CreateTokenContractParams {
  createArg: Hex // Encoded arguments from API
  signature: Hex // Signature from API
  value?: bigint // Optional BNB value to send with transaction
  valueBreakdown?: {
    prebuy?: bigint
    margin?: bigint
  } // Optional breakdown of the value for display purposes
}

export interface CreateTokenContractResult {
  hash: Hex
  tokenAddress?: Address
}

/**
 * Hook for calling the smart contract to create a token
 * This should be called after getting the createArg and signature from the API
 */
export function useCreateTokenContract() {
  const chainId = useChainId()
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { data: balance } = useBalance({ address: account })

  const [isEstimatingGas, setIsEstimatingGas] = useState(false)
  const [isWriting, setIsWriting] = useState(false)

  // Get the contract address from environment variables
  const contractAddress = getCoinRollCoreAddress(chainId)

  /**
   * Estimate gas for the transaction
   */
  const estimateGas = useCallback(
    async (params: CreateTokenContractParams): Promise<bigint | null> => {
      if (!publicClient || !account) {
        toast.error('Wallet not connected')
        return null
      }

      setIsEstimatingGas(true)

      try {
        const gasEstimate = await publicClient.estimateContractGas({
          address: contractAddress,
          abi: CoinRollCoreABI,
          functionName: 'createToken',
          args: [params.createArg, params.signature],
          value: params.value || BigInt(0),
          account,
        })

        return gasEstimate
      } catch (error) {
        console.error('Gas estimation failed:', error)
        handleContractError(error)
        return null
      } finally {
        setIsEstimatingGas(false)
      }
    },
    [publicClient, account, contractAddress]
  )

  /**
   * Execute the createToken transaction on the blockchain
   */
  const createToken = useCallback(
    async (
      params: CreateTokenContractParams
    ): Promise<CreateTokenContractResult | null> => {
      try {
        if (!account) {
          toast.error('Please connect your wallet')
          return null
        }

        // Validate contract address
        if (
          !contractAddress ||
          contractAddress === '0x0000000000000000000000000000000000000000'
        ) {
          toast.error(
            'Contract address not configured. Please set NEXT_PUBLIC_COINROLL_CORE_ADDRESS in environment'
          )
          return null
        }

        // Estimate gas first
        const gasEstimate = await estimateGas(params)
        if (!gasEstimate) {
          return null
        }

        // Calculate total cost including gas and any additional value
        const gasPrice = await publicClient?.getGasPrice()
        const totalGasCost = gasEstimate * (gasPrice || BigInt(5000000000)) // Default 5 Gwei
        const additionalValue = params.value || BigInt(0)
        const totalCost = totalGasCost + additionalValue

        // Check if user has enough balance
        if (balance && balance.value < totalCost) {
          const formatBNB = (value: bigint) => {
            return (Number(value) / 1e18).toFixed(4)
          }
          toast.error('Insufficient BNB balance', {
            description: `Required: ${formatBNB(totalCost)} BNB, Available: ${formatBNB(balance.value)} BNB`,
          })
          return null
        }

        // Show detailed cost breakdown if additional value is included
        if (additionalValue > BigInt(0)) {
          const formatBNB = (value: bigint) => {
            return (Number(value) / 1e18).toFixed(4)
          }

          console.log('Transaction cost breakdown:')
          console.log(`- Gas cost: ${formatBNB(totalGasCost)} BNB`)

          // Show detailed breakdown if provided
          if (params.valueBreakdown) {
            if (
              params.valueBreakdown.prebuy &&
              params.valueBreakdown.prebuy > BigInt(0)
            ) {
              console.log(
                `- Prebuy amount: ${formatBNB(params.valueBreakdown.prebuy)} BNB`
              )
            }
            if (
              params.valueBreakdown.margin &&
              params.valueBreakdown.margin > BigInt(0)
            ) {
              console.log(
                `- Margin amount: ${formatBNB(params.valueBreakdown.margin)} BNB`
              )
            }
          } else {
            console.log(`- Additional value: ${formatBNB(additionalValue)} BNB`)
          }

          console.log(`- Total cost: ${formatBNB(totalCost)} BNB`)

          // Create description based on what's included
          let description = 'Includes:'
          if (params.valueBreakdown) {
            const parts = []
            if (
              params.valueBreakdown.prebuy &&
              params.valueBreakdown.prebuy > BigInt(0)
            ) {
              parts.push(
                `${formatBNB(params.valueBreakdown.prebuy)} BNB for prebuy`
              )
            }
            if (
              params.valueBreakdown.margin &&
              params.valueBreakdown.margin > BigInt(0)
            ) {
              parts.push(
                `${formatBNB(params.valueBreakdown.margin)} BNB for margin`
              )
            }
            description =
              parts.length > 0 ? `Includes: ${parts.join(' + ')}` : ''
          } else {
            description = `Includes ${formatBNB(additionalValue)} BNB additional value`
          }

          toast.info(`Total transaction cost: ${formatBNB(totalCost)} BNB`, {
            description,
          })
        }

        if (!walletClient) {
          toast.error('Wallet not connected')
          return null
        }

        setIsWriting(true)

        try {
          // Send transaction using wallet client
          const hash = await walletClient.writeContract({
            address: contractAddress,
            abi: CoinRollCoreABI,
            functionName: 'createToken',
            args: [params.createArg, params.signature],
            value: params.value || BigInt(0),
            gas: gasEstimate,
            account: account!,
          })

          console.log('Transaction sent with hash:', hash)

          return { hash, tokenAddress: undefined }
        } catch (writeError) {
          console.error('Transaction failed:', writeError)
          handleContractError(writeError)
          return null
        } finally {
          setIsWriting(false)
        }
      } catch (error) {
        console.error('Token creation failed:', error)
        handleContractError(error)
        return null
      }
    },
    [account, balance, contractAddress, estimateGas, publicClient, walletClient]
  )

  return {
    // Main function
    createToken,
    estimateGas,

    // Transaction state
    isLoading: isWriting || isEstimatingGas,
    isPending: isWriting,
  }
}
