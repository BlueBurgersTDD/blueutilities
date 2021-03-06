import * as threads from "worker_threads";
import * as path from "path";
import { safeEvalReturnedType, vmOptionsType, initialMessageType } from "./types";

function safeEval(evalCode: string, vmOptions: vmOptionsType = { enabled: true }): Promise<safeEvalReturnedType> {
    return new Promise(function (resolve, _reject) {
        let response: safeEvalReturnedType = {
            "error": false,
            "output": ""
        }
        try {
            vmOptions.enabled = vmOptions.enabled ?? true;
            vmOptions.timeout = vmOptions.timeout ?? 500;
            vmOptions.ramLimit = vmOptions.ramLimit ?? 16;
            if (vmOptions.enabled) {
                const worker = new threads.Worker(path.join(__dirname, "/safeEvalWorker.js"), {
                    resourceLimits: {
                        maxOldGenerationSizeMb: vmOptions.ramLimit,
                        maxYoungGenerationSizeMb: vmOptions.ramLimit
                    }
                });
                let timeoutTimeout = setTimeout(() => {
                    let awaitWorkerTerminateTimeout = setTimeout(() => {
                        response.error = true;
                        response.output = "Catastrophic error: Worker took longer then 2 seconds to terminate. Please report this.";
                        resolve(response);
                    }, 2000)
                    worker.terminate().then(() => {
                        clearTimeout(awaitWorkerTerminateTimeout);
                        response.error = true;
                        response.output = "Too slow response.";
                        resolve(response);
                    });
                }, vmOptions.timeout)
                worker.once("online", () => {
                    let messageToSend: initialMessageType = { evalCode, vmOptions };
                    worker.postMessage(messageToSend);
                });
                worker.once("message", (msg: safeEvalReturnedType) => {
                    if (msg instanceof Error) response.error = true;
                    if (!msg || !msg.error || msg.output) {
                        msg = msg ?? {
                            error: true,
                            output: "Worker did not send a valid message."
                        }
                    }
                    response.error = msg.error ?? response.error;
                    response.output = `${msg.output}`;
                    let awaitWorkerTerminateTimeout = setTimeout(() => {
                        response.error = true;
                        response.output = "Catastrophic error: Worker took longer then 2 seconds to terminate. Please report this.";
                        resolve(response);
                    }, 2000)
                    clearTimeout(timeoutTimeout);
                    worker.terminate().then(() => {
                        clearTimeout(awaitWorkerTerminateTimeout);
                        resolve(response);
                    })
                });
                worker.once("error", err => {
                    if (err.name == "ERR_WORKER_OUT_OF_MEMORY") {
                        let awaitWorkerTerminateTimeout = setTimeout(() => {
                            response.error = true;
                            response.output = "Catastrophic error: Worker took longer then 2 seconds to terminate. Please report this.";
                            resolve(response);
                        }, 2000)
                        worker.terminate().then(() => {
                            clearTimeout(awaitWorkerTerminateTimeout);
                            clearTimeout(timeoutTimeout);
                            response.error = true;
                            response.output = "Ran out of memory";
                            resolve(response);
                        })
                    }
                })
            } else {
                try {
                    response.output = `${eval(evalCode)}`;
                    resolve(response);
                } catch (err) {
                    response.error = true;
                    response.output = err.toString();
                    resolve(response);
                }
            }
        } catch (err) {
            response.error = true;
            response.output = "An unknown error occurred while executing safeEval: " + err + "\nPlease submit a issue.";
            resolve(response);
        }
    });
}

function replaceAll(text: string, textReplace: string, textReplace2: string): string {
    return text.split(textReplace).join(textReplace2).toString();
}
function setupReplaceAll(): void {
    String.prototype["replaceAll"] = function (textReplace, textReplace2) {
        return replaceAll(this, textReplace, textReplace2);
    }
}
function promiseSleep(ms: number): Promise<void> {
    return new Promise(function (resolve, reject) {
        if (isNaN(ms)) reject("Incorrect usage! Correct usage: blueutilities.promiseSleep(Number);");
        setTimeout(resolve, ms);
    });
}


export { promiseSleep, setupReplaceAll, replaceAll, safeEval }
export default { promiseSleep, setupReplaceAll, replaceAll, safeEval }