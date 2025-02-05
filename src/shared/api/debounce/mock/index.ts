import { getDelay } from '@/shared/utils/delay'
import { IAbortable } from '../types'

interface IMakeRequest {
    page?: number
}

interface IResponse {
    data: {
        count: number
    } | null
}

export async function makeRequest({ page }: IMakeRequest) {
    await getDelay(50)
    const result: IAbortable<PromiseLike<IResponse>> = {
        abort: () => {},
        response: Promise.resolve<IResponse>({ data: { count: 31 } }),
    }
    return result
}
