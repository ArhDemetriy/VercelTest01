import { IAbortedResponse } from '../types'

interface IMakeRequest {
    page?: number
}

interface IResponse {
    data: {
        count: number
    } | null
}

export function makeRequest({ page }: IMakeRequest): IAbortedResponse<IResponse> {
    return {
        abort: () => {},
        response: Promise.resolve<IResponse>({ data: { count: 31 } }),
    }
}
