import { getDelay } from '@/shared/utils/delay'
import { IAbortable } from '../types'

interface IMakeRequest<T> {
    delayInit?: number
    delayResponse?: number
    data?: T
}

export async function asyncMake_asyncRequest<T>({
    delayInit = 0,
    delayResponse = 0,
    data,
}: IMakeRequest<T> = {}) {
    await getDelay(delayInit)
    const result: IAbortable<PromiseLike<typeof data>> = {
        abort: () => {},
        response: getDelay(delayResponse, data),
    }
    return result
}

export function sinkMake_asyncRequest<T>({
    delayResponse = 0,
    data,
}: Omit<IMakeRequest<T>, 'delayInit'> = {}) {
    const result: IAbortable<PromiseLike<typeof data>> = {
        abort: () => {},
        response: getDelay(delayResponse, data),
    }
    return result
}
