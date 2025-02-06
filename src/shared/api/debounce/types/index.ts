export type IAborted = Pick<AbortController, 'abort'>
export interface IAbortable<Data> extends IAborted {
    response: Data
}
