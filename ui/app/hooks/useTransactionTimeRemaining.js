import { getEstimatedGasPrices, getEstimatedGasTimes, getFeatureFlags } from '../selectors'
import { hexWEIToDecGWEI } from '../helpers/utils/conversions.util'
import { useSelector } from 'react-redux'
import { useRef, useEffect, useState, useMemo } from 'react'
import { isEqual } from 'lodash'
import { getRawTimeEstimateData } from '../helpers/utils/gas-time-estimates.util'


function calcTransactionTimeRemaining (initialTimeEstimate, submittedTime) {
  const currentTime = (new Date()).getTime()
  const timeElapsedSinceSubmission = (currentTime - submittedTime) / 1000
  const timeRemainingOnEstimate = initialTimeEstimate - timeElapsedSinceSubmission

  const renderingTimeRemainingEstimate = `~ ${Math.round(timeRemainingOnEstimate / 60)}min`

  return renderingTimeRemainingEstimate
}

export function useTransactionTimeRemaining (isPending, isEarliestNonce, submittedTime, currentGasPrice) {
  // the following two selectors return the result of mapping over an array,
  // as such they will always be new objects and trigger effects. To avoid
  // this, we use isEqual as the equalityFn to only update when the data is
  // new.
  const gasPrices = useSelector(getEstimatedGasPrices, isEqual)
  const estimatedTimes = useSelector(getEstimatedGasTimes, isEqual)
  const interval = useRef()
  const [timeRemaining, setTimeRemaining] = useState(null)
  const featureFlags = useSelector(getFeatureFlags)
  const transactionTimeFeatureActive = featureFlags?.transactionTime

  // Memoize this value so it can be used as a dependency in the effect below
  const initialTimeEstimate = useMemo(() => {
    const customGasPrice = Number(hexWEIToDecGWEI(currentGasPrice))
    const {
      newTimeEstimate,
    } = getRawTimeEstimateData(customGasPrice, gasPrices, estimatedTimes)
    return newTimeEstimate
  }, [ currentGasPrice, gasPrices, estimatedTimes ])

  useEffect(() => {
    if (transactionTimeFeatureActive && isPending && isEarliestNonce && !isNaN(initialTimeEstimate)) {
      clearInterval(interval.current)
      setTimeRemaining(calcTransactionTimeRemaining(initialTimeEstimate, submittedTime))
      interval.current = setInterval(() => {
        setTimeRemaining(calcTransactionTimeRemaining(initialTimeEstimate, submittedTime))
      }, 1000)
      return () => clearInterval(interval.current)
    }
  }, [transactionTimeFeatureActive, submittedTime, initialTimeEstimate])

  // if the transaction is not pending, not the earliest nonce, or the feature is not active,
  // timeRemaining will be null
  return timeRemaining
}
