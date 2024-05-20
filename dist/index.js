import cookie from 'cookie';
import { SuperFetch } from 'sveltekit-superfetch';
import { dev } from '$app/environment';
export class MedusaClient {
    url;
    timeout = 8000;
    retry = 0;
    headers;
    persistentCart = false;
    logger = console;
    logFormat = 'json';
    logLevel = (dev) ? 'limited' : 'silent';
    excludedPaths = ['/store/auth'];
    limitedPaths = [];
    superFetch;
    constructor(url, options) {
        this.url = url;
        if (options) {
            let { timeout, retry, headers, persistentCart, logger, logFormat, logLevel, excludedPaths, limitedPaths } = options;
            if (timeout)
                this.timeout = timeout;
            if (retry)
                this.retry = retry;
            if (headers)
                this.headers = headers;
            if (persistentCart)
                this.persistentCart = persistentCart;
            if (logger)
                this.logger = logger;
            if (logFormat)
                this.logFormat = logFormat;
            if (logLevel)
                this.logLevel = logLevel;
            if (excludedPaths) {
                for (const excluded of excludedPaths) {
                    this.excludedPaths.push(excluded);
                }
            }
            if (limitedPaths) {
                for (const limited of limitedPaths) {
                    this.limitedPaths.push(limited);
                }
            }
        }
        this.superFetch = new SuperFetch({
            retry: this.retry,
            timeout: this.timeout,
            logger: this.logger,
            logFormat: this.logFormat,
            logLevel: this.logLevel,
            excludedPaths: this.excludedPaths,
            limitedPaths: this.limitedPaths
        });
    }
    async query(options) {
        const { locals, path, method = 'GET', body = {}, ...rest } = options;
        let headers = {};
        if (this.headers) {
            for (const [key, value] of Object.entries(this.headers)) {
                headers[key] = value;
            }
        }
        if (locals && locals.sid) {
            headers['Cookie'] = `connect.sid=${locals.sid}`;
        }
        if (Object.keys(body).length != 0) {
            headers['Content-Type'] = 'application/json';
        }
        return await this.superFetch.query({
            url: `${this.url}${path}`,
            method,
            headers,
            body: (Object.keys(body).length != 0) ? JSON.stringify(body) : null,
            ...rest
        }).catch((e) => {
            console.log(e);
            return null;
        });
    }
    buildQuery(base, options = {}) {
        let queryString = base;
        if (Object.keys(options).length !== 0)
            queryString += '?';
        if (options.limit)
            queryString += `limit=${options.limit}&`;
        if (options.offset)
            queryString += `offset=${options.offset}&`;
        if (options.order)
            queryString += `order=${options.order}&`;
        if (options.expand)
            queryString += `expand=${encodeURIComponent(options.expand)}&`;
        if (options.fields)
            queryString += `fields=${encodeURIComponent(options.fields)}&`;
        if (options.query)
            queryString += `${encodeURIComponent(options.query)}&`;
        return queryString;
    }
    async handleRequest(event) {
        // this middleware function is called by src/hooks.server.ts or src/hooks.server.js
        event.locals.sid = event.cookies.get('sid');
        if (event.locals.sid)
            event.locals.user = await this.getCustomer(event.locals, event.cookies);
        else
            event.locals.sid = '';
        event.locals.cartid = event.cookies.get('cartid');
        let cart = await this.getCart(event.locals, event.cookies);
        event.locals.cartid = cart?.id || '';
        event.locals.cart = cart || null;
        return event;
    }
    async parseAuthCookie(setCookie = [], locals, cookies) {
        console.log("running setCookie in parseAuthCookie: ", setCookie);
        if (!setCookie)
            return false;
        try {
            for (let rawCookie of setCookie) {
                let parsedCookie = cookie.parse(rawCookie);
                if (parsedCookie['connect.sid']) {
                    locals.sid = parsedCookie['connect.sid'];
                    let expires = new Date(parsedCookie['Expires']);
                    let maxAge = Math.floor((expires.getTime() - Date.now()) / 1000);
                    cookies.set('sid', locals.sid, {
                        path: '/',
                        maxAge: maxAge,
                        // sameSite: 'strict',
                        httpOnly: true,
                        secure: true
                    });
                    return true;
                }
            }
        }
        catch (e) {
            console.log(e);
            return false;
        }
    }
    async getCustomer(locals, cookies) {
        // returns a user object if found, or null if not
        return await this.query({
            locals,
            path: '/store/auth'
        }).then((response) => {
            this.parseAuthCookie(response.headers.getSetCookie(), locals, cookies);
            return response.json().then((data) => data.customer);
        }).catch(() => null);
    }
    async login(locals, cookies, email, password) {
        // returns true or false based on success
        const response = await this.query({
            locals,
            path: '/store/auth',
            method: 'POST',
            body: { email, password },
            logLevel: 'verbose'
        });
        console.log("response in login: ", response?.statusText);
        if (!response || !response.ok)
            return false;
        // @ts-ignore, getSetCookie() is new and not yet in the type definition for Headers, but it is valid
        return await this.parseAuthCookie(response.headers?.getSetCookie(), locals, cookies).catch(() => false);
    }
    async logout(locals, cookies) {
        // returns true or false based on success
        let success = await this.query({
            locals,
            path: '/store/auth',
            method: 'DELETE'
        }).then((res) => res.ok).catch(() => false);
        if (!success)
            return false;
        locals.sid = '';
        locals.user = {};
        cookies.delete('sid');
        return true;
    }
    async register(locals, cookies, user) {
        // returns true or false based on success
        const { email, password } = user;
        return await this.query({
            locals,
            path: '/store/customers',
            method: 'POST',
            body: user,
            logLevel: 'silent'
        }).then((res) => {
            if (res.ok) {
                return this.login(locals, cookies, email, password).then(() => true).catch(() => false);
            }
            else
                return false;
        }).catch(() => false);
    }
    async getSearchResults(q, cacheOptions) {
        // returns an array of hits, if any
        if (!q) {
            return Array();
        }
        return await this.query({
            path: '/store/products/search',
            method: 'POST',
            body: { q },
            ...cacheOptions
        }).then((res) => res.json()).then((data) => data.hits).catch(() => null);
    }
    async getProducts(options, cacheOptions) {
        // returns an array of product objects
        const queryString = this.buildQuery('/store/products', options);
        return await this.query({ path: queryString, ...cacheOptions })
            .then((res) => res.json()).then((data) => data.products).catch(() => null);
    }
    async getCollections(options, cacheOptions) {
        // returns an array of collection objects on success
        const queryString = this.buildQuery('/store/collections', options);
        return await this.query({ path: queryString, ...cacheOptions })
            .then((res) => res.json()).then((data) => data.collections).catch(() => null);
    }
    async getCollection(handle, cacheOptions) {
        // returns a collection object on success
        return await this.query({ path: `/store/collections?handle[]=${handle}`, ...cacheOptions })
            .then((res) => res.json()).then((data) => data.collections[0]).catch(() => null);
    }
    async getCollectionProducts(id, options, cacheOptions) {
        // returns an array of product objects on success
        let base = `/store/products?collection_id[]=${id}`;
        const queryString = this.buildQuery(base, options);
        return await this.query({ path: queryString, ...cacheOptions })
            .then((res) => res.json()).then((data) => data.products).catch(() => null);
    }
    async getProduct(handle, cacheOptions) {
        // returns a product object on success
        let product = await this.query({ path: `/store/products?handle=${handle}`, ...cacheOptions })
            .then((res) => res.json()).then((data) => data.products[0]).catch(() => null);
        if (!product) {
            return null;
        }
        for (let option of product.options) {
            option.filteredValues = this.filteredValues(option);
        }
        return product;
    }
    async getReviews(productId, options, cacheOptions) {
        // returns an array of review objects on success
        // options - page = 1, limit = 10, sort = 'created_at', order = 'desc', search = null
        // TODO: handle options
        return await this.query({ path: `/store/products/${productId}/reviews`, ...cacheOptions })
            .then((res) => res.json()).then((data) => data.product_reviews).catch(() => null);
    }
    async getCustomerReviews(locals, options) {
        // returns an array of review objects on success
        // options - page = 1, limit = 10, sort = 'created_at', order = 'desc', search = null
        // TODO: handle options
        return await this.query({ locals, path: `/store/customers/me/reviews` })
            .then((res) => res.json()).then((data) => data.product_reviews).catch(() => null);
    }
    async getReview(reviewId) {
        // returns a review object on success
        return await this.query({ path: `/store/reviews/${reviewId}` })
            .then((res) => res.json()).then((data) => data.product_review).catch(() => null);
    }
    // CHANGE TO RETURN THE REVIEW OBJECT ON SUCCESS
    async addReview(locals, review) {
        // returns true or false based on success
        return await this.query({
            locals,
            path: `/store/products/${review.product_id}/reviews`,
            method: 'POST',
            body: review
        })
            .then((res) => res.ok).catch(() => false);
    }
    async updateReview(locals, reviewId, review) {
        // returns a review object on success, or null on failure
        return await this.query({
            locals,
            path: `/store/reviews/${reviewId}`,
            method: 'POST',
            body: review
        }).then((res) => res.ok).catch(() => null);
    }
    async getCart(locals, cookies) {
        // returns a cart array on success, otherwise null
        let cart;
        if (locals.cartid) {
            cart = await this.query({ locals, path: `/store/carts/${locals.cartid}` })
                .then((res) => res.json()).then((data) => data.cart).catch(() => null);
            // if this cart was completed on another device, we don't want to use it
            if (cart && cart.completed_at)
                cart = null;
        }
        else if (this.persistentCart && locals.user) {
            cart = await this.query({ locals, path: `/store/customers/me/cart` })
                .then((res) => res.json()).then((data) => data.cart).catch(() => null);
            if (cart) {
                cookies.set('cartid', cart.id, {
                    path: '/',
                    maxAge: 60 * 60 * 24 * 400,
                    sameSite: 'strict',
                    httpOnly: true,
                    secure: true
                });
            }
        }
        if (locals.cartid && !cart) {
            locals.cartid = '';
            cookies.delete('cartid');
        }
        return cart;
    }
    async addToCart(locals, cookies, variantId, quantity = 1) {
        // returns a cart array on success, otherwise null
        if (!variantId) {
            return null;
        }
        // try adding to existing cart
        if (locals.cartid) {
            try {
                const cart = await this.query({
                    locals,
                    path: `/store/carts/${locals.cartid}/line-items`,
                    method: 'POST',
                    body: { variant_id: variantId, quantity: quantity }
                }).then((res) => res.json()).then((data) => data.cart);
                return cart;
            }
            catch { }
        }
        // if no cart or add to cart fails, try to create new cart
        const cart = await this.query({
            locals,
            path: '/store/carts',
            method: 'POST',
            body: { items: [{ variant_id: variantId, quantity: quantity }] }
        }).then((res) => res.json()).then((data) => data.cart).catch(() => null);
        cookies.set('cartid', cart.id, {
            path: '/',
            maxAge: 60 * 60 * 24 * 400,
            sameSite: 'strict',
            httpOnly: true,
            secure: true
        });
        locals.cartid = cart.id;
        return cart;
    }
    async removeFromCart(locals, itemId) {
        // returns a cart array on success, otherwise null
        if (!locals.cartid || !itemId) {
            return null;
        }
        return await this.query({
            locals,
            path: `/store/carts/${locals.cartid}/line-items/${itemId}`,
            method: 'DELETE'
        })
            .then((res) => res.json()).then((data) => data.cart).catch(() => null);
    }
    async updateCart(locals, itemId, quantity) {
        // returns a cart array on success, otherwise null
        if (!locals.cartid || !itemId || !quantity) {
            return null;
        }
        return await this.query({
            locals,
            path: `/store/carts/${locals.cartid}/line-items/${itemId}`,
            method: 'POST',
            body: { quantity: quantity }
        }).then((res) => res.json()).then((data) => data.cart).catch(() => null);
    }
    async updateCartBillingAddress(locals, address) {
        // returns a cart array on success, otherwise null
        if (!locals.cartid) {
            return null;
        }
        return await this.query({
            locals,
            path: `/store/carts/${locals.cartid}`,
            method: 'POST',
            body: { billing_address: address }
        }).then((res) => res.json()).then((data) => data.cart).catch(() => null);
    }
    async updateCartShippingAddress(locals, address) {
        // returns a cart array on success, otherwise null
        if (!locals.cartid) {
            return null;
        }
        return await this.query({
            locals,
            path: `/store/carts/${locals.cartid}`,
            method: 'POST',
            body: { shipping_address: address }
        }).then((res) => res.json()).then((data) => data.cart).catch(() => null);
    }
    async getShippingOptions(locals) {
        // returns an array of shipping option objects on success, otherwise null
        if (!locals.cartid) {
            return false;
        }
        return await this.query({ locals, path: `/store/shipping-options/${locals.cartid}` })
            .then((res) => res.json()).then((data) => data.shipping_options).catch(() => null);
    }
    async selectShippingOption(locals, shippingOptionId) {
        // returns a cart array on success, otherwise null
        if (!locals.cartid || !shippingOptionId) {
            return null;
        }
        return await this.query({
            locals,
            path: `/store/carts/${locals.cartid}/shipping-methods`,
            method: 'POST',
            body: { option_id: shippingOptionId }
        }).then((res) => res.json()).then((data) => data.cart).catch(() => null);
    }
    async createPaymentSessions(locals) {
        // returns a cart array on success, otherwise null
        if (!locals.cartid) {
            return null;
        }
        return await this.query({
            locals,
            path: `/store/carts/${locals.cartid}/payment-sessions`,
            method: 'POST'
        }).then((res) => res.json()).then((data) => data.cart).catch(() => null);
    }
    async selectPaymentSession(locals, providerId) {
        // returns a cart array on success, otherwise null
        if (!locals.cartid) {
            return null;
        }
        return await this.query({
            locals,
            path: `/store/carts/${locals.cartid}/payment-session`,
            method: 'POST',
            body: { provider_id: providerId }
        }).then((res) => res.json()).then((data) => data.cart).catch(() => null);
    }
    async completeCart(locals) {
        // returns an order object on success, otherwise null
        if (!locals.cartid) {
            return null;
        }
        const reply = await this.query({
            locals,
            path: `/store/carts/${locals.cartid}/complete`,
            method: 'POST'
        }).then((res) => res.json()).catch(() => null);
        return (reply.type === 'order') ? reply.data : false;
    }
    async addShippingAddress(locals, address) {
        // returns true or false based on success
        if (!locals.user) {
            return false;
        }
        return await this.query({
            locals,
            path: `/store/customers/me/addresses`,
            method: 'POST',
            body: { address }
        }).then((res) => res.ok).catch(() => false);
    }
    async updateShippingAddress(locals, addressId, address) {
        // returns true or false based on success
        if (!locals.user) {
            return false;
        }
        return await this.query({
            locals,
            path: `/store/customers/me/addresses/${addressId}`,
            method: 'POST',
            body: address
        }).then((res) => res.ok).catch(() => false);
    }
    async deleteAddress(locals, addressId) {
        // returns true or false based on success
        if (!locals.user) {
            return false;
        }
        return await this.query({
            locals,
            path: `/store/customers/me/addresses/${addressId}`,
            method: 'DELETE'
        }).then((res) => res.ok).catch(() => false);
    }
    async getAddresses(locals) {
        // returns an array of address objects on success, otherwise null
        if (!locals.user) {
            return null;
        }
        return await this.query({ locals, path: `/store/customers/me/addresses` })
            .then((res) => res.json()).then((data) => data.addresses).catch(() => null);
    }
    async getOrder(locals, id) {
        // returns an order object on success, otherwise null
        return await this.query({ locals, path: `/store/orders/${id}` })
            .then((res) => res.json()).then((data) => data.order).catch(() => null);
    }
    async editCustomer(locals, customer) {
        // returns true or false based on success
        if (!locals.user) {
            return false;
        }
        return await this.query({
            locals,
            path: '/store/customers/me',
            method: 'POST',
            body: customer
        }).then((res) => res.ok).catch(() => false);
    }
    async requestResetPassword(email) {
        // returns true or false based on success
        return await this.query({
            path: '/store/customers/password-token',
            method: 'POST',
            body: { email }
        }).then((res) => res.ok).catch(() => false);
    }
    async resetPassword(email, password, token) {
        // returns true or false based on success
        return await this.query({
            path: '/store/customers/password-reset',
            method: 'POST',
            body: { email, password, token }
        }).then((res) => res.ok).catch(() => false);
    }
    // @ts-ignore
    onlyUnique = (value, index, self) => self.indexOf(value) === index;
    // @ts-ignore
    filteredValues = (option) => option.values.map((v) => v.value).filter(this.onlyUnique);
}
