import { createHash } from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import type { Logging } from 'homebridge' with { 'resolution-mode': 'import' };

export type SessionCallback = (error: Error | null) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SessionGetCallback = (error: Error | null, body: any) => void;

function sha256hex(data: string): string {
    return createHash('sha256').update(data).digest('hex');
}

export class RademacherHomePilotSession {
    private readonly log: Logging;
    private readonly debug: boolean;
    private readonly url: string;
    private readonly password: string | null;
    private readonly client: AxiosInstance;

    constructor(log: Logging, debug: boolean, url: string, password?: string, passwordHashed?: boolean | string) {
        this.log = log;
        this.debug = debug;
        this.url = url;
        const hashed = String(passwordHashed).toLowerCase() === 'true';
        this.password = password ? (hashed ? password : sha256hex(password)) : null;
        // All requests share one axios instance whose cookie jar carries the
        // session cookie obtained by login().
        this.client = wrapper(axios.create({ jar: new CookieJar(), withCredentials: true }));
    }

    login(callback: SessionCallback): void {
        if (!this.password) {
            this.log('Warning. No password has been configured. Consider protecting access to your HomePilot.');
            callback(null);
            return;
        }
        this.client.post(this.url + '/authentication/password_salt', '', {
            timeout: 30000,
            headers: { 'content-type': 'application/json' },
        })
            .then((response) => {
                const salt: string = response.data.password_salt;
                this.client.post(this.url + '/authentication/login',
                    { password: sha256hex(salt + this.password), password_salt: salt },
                    {
                        timeout: 30000,
                        headers: { 'content-type': 'application/json' },
                    })
                    .then(() => {
                        this.log('Successfully logged into HomePilot.');
                        callback(null);
                    })
                    .catch((error) => {
                        if (axios.isAxiosError(error) && error.response) {
                            this.log('Error response: ' + JSON.stringify(error.response.data));
                            if (error.response.status === 500) {
                                // 500 here when the salt endpoint worked means wrong password.
                                error = new Error("Wrong password. Make sure the configured HomePilot's password is correct.");
                            }
                        }
                        this.log('Login error: ' + error);
                        callback(error);
                    });
            })
            .catch((error) => {
                if (axios.isAxiosError(error) && error.response && error.response.status === 500) {
                    // Salt endpoint fails with 500 when password is disabled.
                    this.log('Warning. Password has been configured but does not appear to be enabled on HomePilot.');
                    callback(null);
                    return;
                }
                this.log('Login salt error: ' + error);
                callback(error);
            });
    }

    logout(callback: SessionCallback): void {
        if (!this.password) {
            callback(null);
            return;
        }
        this.client.post(this.url + '/authentication/logout', '', {
            timeout: 30000,
            headers: { 'content-type': 'application/json' },
        })
            .then(() => {
                callback(null);
            })
            .catch((error) => {
                this.log('Logout error for path %s/authentication/logout: %s', this.url, error);
                callback(error);
            });
    }

    get(path: string, timeout: number, callback: SessionGetCallback): void {
        this.client.get(this.url + path, { timeout: timeout })
            .then((response) => {
                callback(null, response.data);
            })
            .catch((error) => {
                this.log('GET error for path %s%s: %s', this.url, path, error);
                callback(error, null);
            });
    }

    put(path: string, params: unknown, timeout: number, callback: SessionCallback): void {
        this.client.put(this.url + path, params, {
            timeout: timeout,
            headers: { 'content-type': 'application/json' },
        })
            .then(() => {
                callback(null);
            })
            .catch((error) => {
                this.log('PUT error for path %s%s: %s', this.url, path, error);
                callback(error);
            });
    }

    post(path: string, params: unknown, timeout: number, callback: SessionCallback): void {
        this.client.post(this.url + path, params, {
            timeout: timeout,
            headers: { 'content-type': 'application/json' },
        })
            .then(() => {
                callback(null);
            })
            .catch((error) => {
                this.log('POST error for path %s%s: %s', this.url, path, error);
                callback(error);
            });
    }
}
