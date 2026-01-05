/**
 * Generic transaction monitoring hook
 * Monitors blockchain transactions and provides UI feedback
 * Completely decoupled from any specific business logic
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { usePublicClient, useChainId } from 'wagmi'
import { type Hex } from 'viem'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

export interface TransactionMonitorOptions {
  onSuccess?: (receipt: any) => void
  onError?: (error: Error) => void
  onSettled?: () => void
  successMessage?: string
  errorMessage?: string
  showExplorerLink?: boolean
  autoDisableForm?: boolean
  useDialog?: boolean // Option to use dialog instead of toast
  onDialogOpen?: (receipt: any) => void // Callback when dialog should open
}

export interface TransactionMonitorResult {
  startMonitoring: (hash: Hex) => void
  isMonitoring: boolean
  receipt: any | null
  error: Error | null
}

/**
 * Hook for monitoring blockchain transactions
 * Provides toast notifications with explorer links
 */
export function useTransactionMonitor(
  options: TransactionMonitorOptions = {}
): TransactionMonitorResult {
  const {
    onSuccess,
    onError,
    onSettled,
    successMessage,
    errorMessage,
    showExplorerLink = true,
    useDialog = false,
    onDialogOpen,
  } = options

  const t = useTranslations()
  const chainId = useChainId()
  const publicClient = usePublicClient()

  const [isMonitoring, setIsMonitoring] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const [error, setError] = useState<Error | null>(null)
  const toastIdRef = useRef<string | number | null>(null)

  /**
   * Get blockchain explorer URL for transaction
   */
  const getExplorerUrl = useCallback(
    (hash: string) => {
      if (chainId === 56) {
        return `https://bscscan.com/tx/${hash}`
      }
      return `https://testnet.bscscan.com/tx/${hash}`
    },
    [chainId]
  )

  /**
   * Start monitoring a transaction
   */
  const startMonitoring = useCallback(
    async (hash: Hex) => {
      if (!publicClient || isMonitoring) return

      setIsMonitoring(true)
      setReceipt(null)
      setError(null)

      // Show loading toast
      toastIdRef.current = toast.loading(
        t('createToken.contractCall.waitingForConfirmation'),
        {
          description: `${hash.slice(0, 10)}...${hash.slice(-8)}`,
        }
      )

      try {
        // Wait for transaction receipt
        const txReceipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
          timeout: 60_000, // 60 seconds
        })

        setReceipt(txReceipt)

        // Dismiss loading toast
        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current)
        }

        const explorerUrl = getExplorerUrl(hash)

        if (txReceipt?.status === 'success') {
          // Use dialog if enabled, otherwise use toast
          if (useDialog && onDialogOpen) {
            // Call the dialog open callback
            onDialogOpen(txReceipt)
          } else {
            // Success notification via toast
            toast.success(successMessage || t('createToken.success.title'), {
              description: t('createToken.success.message', {
                address: hash.slice(0, 10) + '...' + hash.slice(-8),
              }),
              duration: 10000,
              action: showExplorerLink
                ? {
                    label: t('createToken.success.viewOnExplorer'),
                    onClick: () => window.open(explorerUrl, '_blank'),
                  }
                : undefined,
            })
          }

          onSuccess?.(txReceipt)
        } else {
          // Transaction failed on-chain
          const txError = new Error('Transaction reverted on-chain')
          setError(txError)

          toast.error(
            errorMessage || t('createToken.errors.transactionFailed'),
            {
              description: t('createToken.errors.transactionReverted'),
              duration: 10000,
              action: showExplorerLink
                ? {
                    label: t('createToken.success.viewOnExplorer'),
                    onClick: () => window.open(explorerUrl, '_blank'),
                  }
                : undefined,
            }
          )

          onError?.(txError)
        }
      } catch (err: any) {
        // Monitoring error (timeout, network issue, etc.)
        const monitorError: Error =
          err instanceof Error ? err : new Error(String(err))
        setError(monitorError)

        // Dismiss loading toast
        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current)
        }

        const explorerUrl = getExplorerUrl(hash)

        toast.error(t('createToken.errors.transactionStatusUnknown'), {
          description: t('createToken.errors.checkExplorer'),
          duration: 10000,
          action: showExplorerLink
            ? {
                label: t('createToken.success.viewOnExplorer'),
                onClick: () => window.open(explorerUrl, '_blank'),
              }
            : undefined,
        })

        onError?.(monitorError)
      } finally {
        setIsMonitoring(false)
        onSettled?.()
      }
    },
    [
      publicClient,
      isMonitoring,
      t,
      getExplorerUrl,
      successMessage,
      errorMessage,
      showExplorerLink,
      useDialog,
      onDialogOpen,
      onSuccess,
      onError,
      onSettled,
    ]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current)
      }
    }
  }, [])

  return {
    startMonitoring,
    isMonitoring,
    receipt,
    error,
  }
}
