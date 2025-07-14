export function loadSSLConfig(): {
    cert: NonSharedBuffer & string;
    key: NonSharedBuffer & string;
    ca: NonSharedBuffer | undefined;
} | null;
export function validateConfig(): string[];
export namespace serverConfig {
    let mode: string;
    namespace http {
        let port: number;
        let host: string;
        namespace auth {
            let enabled: boolean;
            let type: string;
            let token: string | undefined;
            namespace jwt {
                let enabled_1: boolean;
                export { enabled_1 as enabled };
                export let secret: string | undefined;
                export let expiresIn: string;
            }
        }
        namespace cors {
            let enabled_2: boolean;
            export { enabled_2 as enabled };
            export let origins: string[];
            export let credentials: boolean;
        }
        namespace ssl {
            let enabled_3: boolean;
            export { enabled_3 as enabled };
            export let cert: string | undefined;
            export let key: string | undefined;
            export let ca: string | undefined;
        }
    }
    namespace winccoa {
        namespace manager {
            let num: number;
            let name: string;
            let startOptions: string;
        }
        namespace connection {
            let timeout: number;
            let retryAttempts: number;
            let retryDelay: number;
        }
    }
    namespace logging {
        let level: string;
        let file: string | undefined;
        let maxSize: string;
        let maxFiles: number;
    }
    namespace security {
        namespace rateLimit {
            let enabled_4: boolean;
            export { enabled_4 as enabled };
            export let windowMs: number;
            export let max: number;
        }
        namespace ipFilter {
            let enabled_5: boolean;
            export { enabled_5 as enabled };
            export let whitelist: string[];
            export let blacklist: string[];
        }
    }
    namespace performance {
        let requestTimeout: number;
        namespace connectionPool {
            export let min: number;
            let max_1: number;
            export { max_1 as max };
        }
    }
}
//# sourceMappingURL=server.config.d.ts.map