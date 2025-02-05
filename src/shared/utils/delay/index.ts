export const getDelay = async (delay: number = 0) =>
    new Promise(resolve => {
        setTimeout(resolve, delay)
    })
