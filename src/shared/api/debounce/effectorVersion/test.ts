import { getDelay } from '@/shared/utils/delay'
import { sinkMake_asyncRequest, sinkMake_promiseRequest } from '../mock'
import { makeRCEffectDebounce as debounce } from './debounce'
import { UnitValue, createStore, sample } from 'effector'

describe('debounce init', () => {
    const tested = jest.fn(debounce)
    const mock = jest.fn(sinkMake_asyncRequest)
    afterEach(() => {
        tested.mockClear()
        mock.mockClear()
    })

    it('toBe', () => expect(debounce).toBeDefined())

    it('not run cb on init', () => {
        tested(mock, { sid: 'test' })
        expect(tested.mock.calls.length).toBe(1)
        expect(mock.mock.calls.length).toBe(0)
    })
})

type TData0 = string
describe('debounce returns', () => {
    const tested = debounce
    const mock = sinkMake_asyncRequest<TData0>

    it('export "run" method', () => expect(tested(mock, { sid: 'test' })?.run).toBeDefined())
    it('export loadingList', () =>
        expect(tested(mock, { sid: 'test' })?.$loadingList).toBeDefined())
    it('export agregate all loading', () =>
        expect(tested(mock, { sid: 'test' })?.$isLoading).toBeDefined())
    it('export data', () => expect(tested(mock, { sid: 'test' })?.doneData).toBeDefined())

    describe('return correct data in next macrotask after running', () => {
        const data1: TData0 = 'data1'
        const data2: TData0 = 'data2'
        const data3: TData0 = 'data3'

        const getEndpoint = () => {
            const { run, doneData } = tested(mock, { sid: 'test' })
            const result = sample({
                clock: doneData,
                target: createStore<UnitValue<typeof doneData> | null>(null, { sid: 'result' }),
            })
            return { run, result }
        }
        let run: ReturnType<typeof getEndpoint>['run']
        let result: ReturnType<typeof getEndpoint>['result']
        beforeEach(() => {
            const endpoint = getEndpoint()
            run = endpoint.run
            result = endpoint.result
        })

        it('return correct data in next macrotask after running', async () => {
            run({ payload: { data: data1 } })

            await getDelay()
            expect(result.getState()?.data).toBe(data1)
            await getDelay(100)
            expect(result.getState()?.data).toBe(data1)
        })
        it('для множественных вызовов, возвращает рузультат последнего вызова', async () => {
            run({ payload: { data: data1 } })
            run({ payload: { data: data2 } })
            run({ payload: { data: data3 } })

            await getDelay()
            expect(result.getState()?.data).toBe(data3)
            await getDelay(100)
            expect(result.getState()?.data).toBe(data3)
        })
        it('для множественных вызовов, разнесённых во времени, возвращает рузультат последнего вызова', async () => {
            run({ payload: { data: data1 } })
            await getDelay(100)
            run({ payload: { data: data2 } })
            await getDelay(50)
            run({ payload: { data: data3 } })

            await getDelay()
            expect(result.getState()?.data).toBe(data3)
            await getDelay(100)
            expect(result.getState()?.data).toBe(data3)
        })
    })
})

type TData1 = string
describe('debounce with sink make', () => {
    const tested = debounce
    const mock = jest.fn(sinkMake_asyncRequest<TData1>)
    afterEach(() => mock.mockClear())

    it('один запуск вызывает функцию 1 раз', () => {
        tested(mock, { sid: 'test' }).run({})
        expect(mock.mock.calls.length).toBe(1)
    })

    const runTestCalling = (maxCount: number) =>
        describe.skip(`${maxCount} синхронных попыток вызвать запрос`, () => {
            it('Должны триггерить срабатывание только одного вызова.', () => {
                const { run } = tested(mock, { sid: 'test' })
                for (let i = 0; i < maxCount; i++) run({ payload: { delayResponse: 0 } })
                expect(mock.mock.calls.length).toBe(1)
            })
            describe('Должны триггерить срабатывание только одного вызова.', () => {
                it('Даже если ответ приходит в рамках текущего макротаска.', () => {
                    const mock = jest.fn(sinkMake_promiseRequest)
                    const { run } = tested(mock, { sid: 'test' })
                    for (let i = 0; i < maxCount; i++) run({})
                    expect(mock.mock.calls.length).toBe(1)
                })
                it('Даже если ответ приходит с задержкой.', () => {
                    const { run } = tested(mock, { sid: 'test' })
                    for (let i = 0; i < maxCount; i++) run({ payload: { delayResponse: 100 } })
                    expect(mock.mock.calls.length).toBe(1)
                })
            })
        })
    runTestCalling(1)
    runTestCalling(2)
    runTestCalling(3)
    runTestCalling(300)

    describe.skip('для множественных вызовов, возвращает рузультат последнего вызова. Обработка гонки', () => {
        const data1: TData1 = 'data1'
        const data2: TData1 = 'data2'
        const data3: TData1 = 'data3'

        const getEndpoint = () => {
            const { run, doneData } = tested(mock, { sid: 'test' })
            const result = sample({
                clock: doneData,
                target: createStore<UnitValue<typeof doneData> | null>(null, { sid: 'result' }),
            })
            return { run, result }
        }
        let run: ReturnType<typeof getEndpoint>['run']
        let result: ReturnType<typeof getEndpoint>['result']
        beforeEach(() => {
            const endpoint = getEndpoint()
            run = endpoint.run
            result = endpoint.result
        })

        it('игнорирует ответы приходящие после ответа на последний запрос', async () => {
            const maxDelay = 1000
            const lastDelay = 50
            run({ payload: { data: data1, delayResponse: 100 } })
            run({ payload: { data: data2, delayResponse: maxDelay } })
            run({ payload: { data: data3, delayResponse: lastDelay } })

            await getDelay(lastDelay)
            expect(result.getState()?.data).toBe(data3)
            await getDelay(maxDelay - lastDelay)
            expect(result.getState()?.data).toBe(data3)
            await getDelay(maxDelay * 2)
            expect(result.getState()?.data).toBe(data3)
        })

        it('если ответ на первый запрос приходит до ответа на последний запрос, возвращает ответ на первый запрос. После, обязательно возвращает ответ на последний запрос', async () => {
            const minDelay = 50
            const maxDelay = 1000
            const lastDelay = 300
            run({ payload: { data: data1, delayResponse: minDelay } })
            run({ payload: { data: data2, delayResponse: maxDelay } })
            run({ payload: { data: data3, delayResponse: lastDelay } })

            await getDelay(minDelay)
            expect(result.getState()?.data).toBe(data1)
            await getDelay(lastDelay - minDelay)
            expect(result.getState()?.data).toBe(data3)
            await getDelay(maxDelay - lastDelay - minDelay)
            expect(result.getState()?.data).toBe(data3)
            await getDelay(maxDelay * 2)
            expect(result.getState()?.data).toBe(data3)
        })
    })
})
