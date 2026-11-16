/** Pages request mutations; only the background coordinator writes local storage. */
namespace AESPersistence {
    export function request(message: Record<string, unknown>): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response: unknown) => {
                const error = chrome.runtime.lastError;
                if (error) return reject(new Error(error.message));
                if (!response || typeof response !== 'object' || !('ok' in response) || response.ok !== true) {
                    return reject(new Error(response && typeof response === 'object' && 'error' in response ? String(response.error) : 'Storage unavailable.'));
                }
                resolve(response as Record<string, unknown>);
            });
        });
    }
    export async function set(values: Record<string, unknown>): Promise<void> {
        await request({type:'AES_STORAGE_MUTATE',op:'set',values});
    }
    export async function remove(keys: string[]): Promise<void> {
        await request({type:'AES_STORAGE_MUTATE',op:'remove',keys});
    }
    export async function options(op: 'merge' | 'replace' | 'recover' | 'clear' | 'clearLogs', data?: Record<string, unknown>): Promise<void> {
        await request({type:'AES_OPTIONS_STORAGE',op,data});
    }
}
