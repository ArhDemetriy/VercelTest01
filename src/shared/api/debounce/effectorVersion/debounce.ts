import {
    type EventPayload,
    createEffect,
    createEvent,
    createStore,
    sample,
    createApi,
    EventCallable,
} from 'effector'
import { IAbortable } from '../types'

// stores

/** @abstract */
interface IThreadItem {
    /**
     * Ключ идентифицирующий запросы могущие быть запущенными параллельно.
     */
    id: string
}
type IThreads<T extends IThreadItem> = Record<T['id'], T>

/** @abstract */
interface IMarkedItem extends IThreadItem {
    /**
     * Метка времени создания запроса.
     * Генерируется автоматически, но можно установить своё значение.
     * Технически это просто число определяющее порядок созданных запросов.
     * Используесятся для определения актуального запроса.
     */
    time: number
}

interface IRegisteredItem<Payload> extends IMarkedItem {
    /**
     * Данные передаваемые в запрос.
     */
    payload?: Payload
}

interface IDebouncedItem<Payload> extends IRegisteredItem<Payload> {
    timeoutId: ReturnType<typeof setTimeout>
}
type IDebounced<Payload> = IThreads<IDebouncedItem<Payload>>

type IInitializingItem = IMarkedItem
type IInitializing = IThreads<IInitializingItem>

type IAbort = Partial<Pick<AbortController, 'abort'>>
interface IActivesItem extends IMarkedItem, IAbort {}
type IActives = IThreads<IActivesItem>

interface IResultItem<Data> extends IMarkedItem {
    data: Data
}

// function
// type o = Partial<Omit<IRegisteredItem<Payload>, 'payload'>>
type IRequire<Payload> = Payload extends undefined
    ? undefined | Partial<Omit<IRegisteredItem<Payload>, 'payload'>>
    : Required<Pick<IRegisteredItem<Payload>, 'payload'>> &
          Partial<Omit<IRegisteredItem<Payload>, 'payload'>>

type FN<Payload, Data> = (
    payload: Payload,
) => IAbortable<PromiseLike<Data>> | PromiseLike<IAbortable<PromiseLike<Data>>>

type Parameter<F extends FN<any, any>> = Parameters<F>[0]
type Payload<F extends FN<any, any>> = Parameter<F>['payload']
type Return<F extends FN<any, any>> = Awaited<ReturnType<F>>
type Data<F extends FN<any, any>> = Awaited<Return<F>['response']>

// fabric config

interface IConfig {
    sid: string
    /**
     * Задержка между отправкой первого и последующих запросов. Указывается в мс.
     * Второй и последующие запросы созданные в течении этого времени, не отправляются до его истечения.
     * По истечении указанного времени, если были попытки создать второй и последующие запросы, то будет отправлен последний.
     */
    debounce?: number
}

/**
 * фабрика создающая многопоточную, отменяемую очередь запросов, с откладыванием второго и последующего многократных вызовов запроса.
 * Запросы защищены от состояния гонки. И первый запрос вызывается без задержек, для большей отзывчивости интерфейса.
 *
 * Типичный сценарий применения: множество карточек товаров на странице, у которых есть однотипная кнопка добавления товара в корзину.
 * И пользователь может быстро нажать эту кнопку в разных карточках, быстрее чем бэк ответит на запрос добавления в корзину.
 *
 * Данная фабрика позволит блокировать кнопки индивидуально.
 * Держать на одной странице пересекающиеся списки продуктов.
 * Быстро вызывать первый запрос (одиночный клик).
 *
 * Альтернативно блокировки кнопок, можно позволить многократные нажатия (например для кнопок "добавить ещё" ).
 * В этом случае, лишние запросы будут отменятся, а на выходе мы получим данные от последнего вызванного запроса, даже если устаревшие придут с отстванием.
 */
export function makeRCEffectDebounce<CB extends FN<any, any>>(cb: CB, config: IConfig) {
    const { sid, debounce = 0 } = config
    const { run, requireRegistered } = initialize<CB>(config)
    const { toDebounce } = makeDebounced<CB>(requireRegistered, config)
    const { toInitialize, initializing, initializeDone } = makeInitializing(cb, config)
    const { toActives, actives, doneData } = makeActives<CB>(config)

    /** toDebounce */
    sample({
        clock: sample({
            clock: requireRegistered,
            source: { actives, initializing },
            filter: ({ actives, initializing }, { id, time }) =>
                Object.hasOwn(actives, id) &&
                actives[id].time + debounce > time &&
                Object.hasOwn(initializing, id) &&
                initializing[id].time + debounce > time,
            fn: (_, clk) => clk,
        }),
        target: toDebounce,
    })

    /** toInitialize */
    sample({
        clock: sample({
            clock: requireRegistered,
            source: { actives, initializing },
            filter: ({ actives, initializing }, { id, time }) =>
                (!Object.hasOwn(actives, id) || actives[id].time + debounce <= time) &&
                (!Object.hasOwn(initializing, id) || initializing[id].time + debounce <= time),
            fn: (_, clk) => clk,
        }),
        target: toInitialize,
    })

    /** old initialize */
    sample({
        clock: sample({
            clock: initializeDone,
            source: actives,
            filter: (actives, { id, time }) =>
                Object.hasOwn(actives, id) && actives[id].time > time,
            fn: (_, clk) => clk,
        }),
        target: createEffect(({ abort, id }: EventPayload<typeof initializeDone>) =>
            abort?.(`old initialize, maybe slow fetch initializing; sid: ${sid} id: ${id}`),
        ),
    })

    /** toActives */
    sample({
        clock: sample({
            clock: initializeDone,
            source: actives,
            filter: (actives, { id, time }) =>
                !Object.hasOwn(actives, id) || actives[id].time <= time,
            fn: (_, clk) => clk,
        }),
        target: toActives,
    })

    // loading observing
    const $loadingList = sample({
        source: { initializing, actives },
        fn: ({ initializing, actives }) =>
            new Set(Object.keys(initializing).concat(Object.keys(actives))),
    })
    const $isLoading = $loadingList.map(loadingList => !!loadingList.size)

    return { run, doneData, $loadingList, $isLoading }
}

/**
 * Возвращает публичный эвент для запуска запроса.
 * И приватную обётку этого эвента, сохраняющую временную метку.
 * Дальнейшая оценка актуальности запроса и его ответа ведётся по этой метке.
 */
function initialize<CB extends FN<any, any>>({ sid }: IConfig) {
    /** @public */
    const run = createEvent<IRequire<Parameter<CB>>>({ sid: `require${sid}` })

    const requireRegistered = sample({
        clock: sample({
            clock: run,
            target: createEffect<EventPayload<typeof run>, IRegisteredItem<Payload<CB>>>(params =>
                Object.assign({ id: 'undefined', time: Date.now() }, params),
            ),
        }).doneData,
        target: createEvent<IRegisteredItem<Payload<CB>>>(),
    })

    return { run, requireRegistered }
}

/**
 * Создаёт логику откладывания повторных запросов.
 * После паузы, переданной в debounce, вызывает эвент requireAfterDebounce.
 */
function makeDebounced<CB extends FN<any, any>>(
    requireAfterDebounce: EventCallable<IRegisteredItem<Payload<CB>>>,
    { sid, debounce = 0 }: IConfig,
) {
    const debounced = createStore<IDebounced<Payload<CB>>>({}, { sid: `debounced${sid}` })
    const { pushDebounced, forceRemoveDebounce } = createApi(debounced, {
        pushDebounced(debounced, item: IDebouncedItem<Payload<CB>>) {
            if (Object.hasOwn(debounced, item.id)) clearTimeout(debounced[item.id].timeoutId)
            return Object.assign({}, debounced, makeDebouncedFrom(item))
        },
        forceRemoveDebounce(debounced, { id }: IThreadItem) {
            if (!Object.hasOwn(debounced, id)) return debounced
            clearTimeout(debounced[id].timeoutId)
            return Object.fromEntries(Object.entries(debounced).filter(([key]) => key !== id))
        },
    })

    const debounceActivated = createEvent<EventPayload<typeof requireAfterDebounce>>({
        sid: `debounceActivated${sid}`,
    })
    const toDebounce = createEvent<EventPayload<typeof requireAfterDebounce>>({
        sid: `toDebounce${sid}`,
    })
    sample({
        clock: sample({
            clock: toDebounce,
            target: createEffect<
                EventPayload<typeof requireAfterDebounce>,
                IDebouncedItem<Payload<CB>>
            >((data: EventPayload<typeof requireAfterDebounce>) => ({
                ...data,
                timeoutId: setTimeout(debounceActivated, debounce, data),
            })),
        }).doneData,
        target: pushDebounced,
    })

    sample({
        clock: debounceActivated,
        target: [forceRemoveDebounce, requireAfterDebounce],
    })

    return { toDebounce, forceRemoveDebounce }
}

/**
 * Создание хранилища отложенных запросов, с одним элементом.
 * Такой способ нужен для экономии памяти и гарантии сохранности типов и простоты использования.
 * Аналогично сделаны другие make*From функции
 */
const makeDebouncedFrom = <Payload>({
    id,
    payload,
    timeoutId,
    time,
}: IDebouncedItem<Payload>): IDebounced<Payload> => ({
    [id]: { id, payload, timeoutId, time },
})

/**
 * Инициализация запроса с возможностью асинхронности.
 * Здесь главная проблема в невозможности прервать анициализацию до её завершения.
 * Потому, функцию-инициализатор (передаётся главной функции в поле cb), нужно максимально быстро завершать после вызова fetch
 * Прерывание при устаревании запроса, будет производиться уже после инициализации (вторая часть кода в методе).
 *
 * Однако, т.к. код инициализации выполняется локально, всё должно происходить очень быстро.
 * Дополнительно, если запросы устаревают до вызова инициализации, они просто не попадают в эту очередь.
 */
function makeInitializing<CB extends FN<any, any>>(cb: CB, { sid }: IConfig) {
    const initializing = createStore<IInitializing>({}, { sid: `initializing${sid}` })
    const { pushInitializing, removeInitializing } = createApi(initializing, {
        pushInitializing(initializing, item: IInitializingItem) {
            return Object.assign({}, initializing, makeInitializingFrom(item))
        },
        removeInitializing(initializing, { id }: IThreadItem) {
            return Object.fromEntries(Object.entries(initializing).filter(([key]) => key !== id))
        },
    })

    const toInitialize = createEvent<IRegisteredItem<Payload<CB>>>()

    const runFx = createEffect(
        async ({ id, time, payload }: EventPayload<typeof toInitialize>) => ({
            id,
            time,
            // data: (await cb(payload)) as Return<CB>,
            data: (await cb(payload)) as IAbortable<Return<CB>['response']>,
        }),
    )
    sample({
        clock: sample({
            source: initializing,
            clock: toInitialize,
            filter: (initializing, { id, time }) =>
                !Object.hasOwn(initializing, id) || initializing[id].time <= time,
            fn: (_, require) => require,
        }),
        target: [pushInitializing, runFx],
    })

    const errorInitialize = sample({ clock: runFx.fail, fn: clk => clk.params })
    sample({ clock: errorInitialize, target: removeInitializing })

    /**
     * @private
     * После инициализации оказалось что запрос устарел.
     * Что возможно если добавить ещё один запрос за время инициалзации предидущего.
     * Т.е. если инициализация будет занимать больше времени чем debonce
     */
    const deadResponse = sample({
        source: initializing,
        clock: runFx.doneData,
        filter(initializing, { id, time }) {
            if (!Object.hasOwn(initializing, id)) return false
            if (initializing[id].time <= time) return false
            return true
        },
        fn: (_, clk) => clk,
        target: createEvent<IActivesItem>({ sid: `deadResponse${sid}` }),
    })
    sample({
        clock: deadResponse,
        target: createEffect((deadResponse: IActivesItem) =>
            deadResponse.abort?.(
                `dead initialize, maybe slow fetch initializing; sid: ${sid} id: ${deadResponse.id}`,
            ),
        ),
    })
    sample({ clock: deadResponse, target: removeInitializing })

    /**
     * @private
     * После инициализации запрос всё ещё актуален
     */
    const successResponse = sample({
        source: initializing,
        clock: runFx.doneData,
        filter(initializing, { id, time }) {
            if (!Object.hasOwn(initializing, id)) return true
            if (initializing[id].time <= time) return true
            return false
        },
        fn: (_, clk) => clk,
        target: createEvent<EventPayload<typeof runFx.doneData>>({
            sid: `successResponse${sid}`,
        }),
    })
    sample({ clock: successResponse, target: removeInitializing })

    const initializeDone = sample({
        clock: successResponse,
        fn: ({ id, time, data: { response, abort } }) => ({
            id,
            time,
            response,
            abort,
        }),
    })

    const initializeCanceled = sample({
        clock: [errorInitialize, deadResponse],
        fn: ({ id, time }) => ({ id, time } as IInitializingItem),
    })

    return { toInitialize, initializing, initializeDone, initializeCanceled }
}
const makeInitializingFrom = ({ id, time }: IInitializingItem): IInitializing => ({
    [id]: { id, time },
})

/**
 * Хранилище активных запросов ожидающих ответа.
 * В этом состоянии, запросы будут проводить большую часть времени.
 * Большая часть прерываний устаревших запросов будет производиться здесь,
 * просто из-за того что время ожидания ответа примерно в 5-10 раз дольше всего времени до вызова fetch.
 */
function makeActives<CB extends FN<any, any>>({ sid }: IConfig) {
    const actives = createStore<IActives>({}, { sid: `actives${sid}` })
    const { pushActives, removeActives } = createApi(actives, {
        pushActives(actives, item: IActivesItem) {
            const { id } = item
            if (Object.hasOwn(actives, id)) {
                actives[id].abort?.(`replace to new request; sid: ${sid} id: ${id}`)
            }
            return Object.assign({}, actives, makeActivesFrom(item))
        },
        removeActives(actives, { id }: IThreadItem) {
            return Object.fromEntries(Object.entries(actives).filter(([key]) => key !== id))
        },
    })

    const toActives = createEvent<IActivesItem & Pick<Return<CB>, 'response'>>({
        sid: `toActives${sid}`,
    })

    /** old run */
    sample({
        clock: sample({
            clock: toActives,
            source: actives,
            filter: (actives, { id, time }) =>
                Object.hasOwn(actives, id) && actives[id].time > time,
            fn: (_, item) => item,
        }),
        target: createEffect(({ abort, id }: IActivesItem) =>
            abort?.(`old run, maybe slow fetch initializing; sid: ${sid} id: ${id}`),
        ),
    })

    /** pushActives */
    const toPushActives = sample({
        source: actives,
        clock: toActives,
        filter: (actives, { id, time }) => !Object.hasOwn(actives, id) || actives[id].time <= time,
        fn: (_, clk) => clk,
    })
    sample({ clock: toPushActives, target: pushActives })

    const resultFx = sample({
        clock: toPushActives,
        target: createEffect<EventPayload<typeof toPushActives>, IResultItem<Data<CB>>>(
            async ({ id, time, response }) => ({ id, time, data: await response }),
        ),
    })
    sample({
        source: actives,
        clock: sample({
            clock: [
                resultFx.doneData,
                sample({
                    clock: resultFx.fail,
                    fn: ({ params }) => params,
                }),
            ],
            fn: ({ id, time }): IActivesItem => ({ id, time }),
        }),
        filter: (actives, { id, time }) => Object.hasOwn(actives, id) && actives[id].time <= time,
        fn: (_, clk) => clk,
        target: removeActives,
    })

    const { doneData } = resultFx

    return { toActives, actives, doneData }
}

const makeActivesFrom = ({ abort, id, time }: IActivesItem): IActives => ({
    [id]: abort ? { abort, id, time } : { id, time },
})
