export type IAborted = Pick<AbortController, 'abort'>
export interface IAbortedResponse<T> extends IAborted {
    response: PromiseLike<T>
}
