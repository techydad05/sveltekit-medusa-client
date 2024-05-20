import type { ProductDTO } from '@medusajs/types';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
export interface CacheOptions {
    key: string;
    ttl?: number;
}
export interface ProductRetrievalOptions {
    limit?: number;
    offset?: number;
    order?: string;
    expand?: string;
    fields?: string;
    query?: string;
}
export interface CollectionRetrievalOptions {
    limit?: number;
    offset?: number;
}
export interface ReviewRetrievalOptions {
}
export interface Review {
    id?: string;
    product_id: string;
    customer_id?: string;
    display_name: string;
    content: string;
    rating: number;
    approved?: boolean;
}
export interface User {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    phone?: string;
}
export interface Customer {
    first_name?: string;
    last_name?: string;
    billing_address?: Address;
    password?: string;
    phone?: string;
    email?: string;
    metadata?: object;
}
export interface Address {
    first_name: string;
    last_name: string;
    phone?: string;
    company?: string;
    address_1: string;
    address_2?: string;
    city: string;
    country_code: string;
    province: string;
    postal_code: string;
    metadata?: object;
}
export interface ClientOptions {
    retry?: number;
    timeout?: number;
    headers?: {};
    persistentCart?: boolean;
    logger?: Logger;
    logFormat?: 'text' | 'json' | 'majel';
    logLevel?: 'verbose' | 'limited' | 'silent';
    excludedPaths?: string[];
    limitedPaths?: string[];
}
export interface QueryOptions {
    locals?: App.Locals;
    path: string;
    method?: string;
    body?: object;
    key?: string;
    ttl?: number;
    revalidate?: boolean;
    logLevel?: 'verbose' | 'limited' | 'silent';
}
export interface Logger {
    info: (message: string) => void;
    error: (message: string) => void;
}
export declare class MedusaClient {
    private url;
    private timeout;
    private retry;
    private headers;
    private persistentCart;
    private logger;
    private logFormat;
    private logLevel;
    private excludedPaths;
    private limitedPaths;
    private superFetch;
    constructor(url: string, options?: ClientOptions);
    query(options: QueryOptions): Promise<Response | null>;
    buildQuery(base: string, options?: any): string;
    handleRequest(event: RequestEvent): Promise<RequestEvent>;
    parseAuthCookie(setCookie: [] | undefined, locals: App.Locals, cookies: Cookies): Promise<boolean | undefined>;
    getCustomer(locals: App.Locals, cookies: Cookies): Promise<any>;
    login(locals: App.Locals, cookies: Cookies, email: string, password: string): Promise<boolean | undefined>;
    logout(locals: App.Locals, cookies: Cookies): Promise<boolean>;
    register(locals: App.Locals, cookies: Cookies, user: User): Promise<boolean>;
    getSearchResults(q: string, cacheOptions?: CacheOptions): Promise<any>;
    getProducts(options?: ProductRetrievalOptions, cacheOptions?: CacheOptions): Promise<ProductDTO[] | null>;
    getCollections(options?: CollectionRetrievalOptions, cacheOptions?: CacheOptions): Promise<any>;
    getCollection(handle: string, cacheOptions?: CacheOptions): Promise<any>;
    getCollectionProducts(id: string, options?: ProductRetrievalOptions, cacheOptions?: CacheOptions): Promise<ProductDTO[] | null>;
    getProduct(handle: string, cacheOptions?: CacheOptions): Promise<ProductDTO | null>;
    getReviews(productId: string, options?: ReviewRetrievalOptions, cacheOptions?: CacheOptions): Promise<any>;
    getCustomerReviews(locals: App.Locals, options?: ReviewRetrievalOptions): Promise<any>;
    getReview(reviewId: string): Promise<any>;
    addReview(locals: App.Locals, review: Review): Promise<any>;
    updateReview(locals: App.Locals, reviewId: string, review: Review): Promise<any>;
    getCart(locals: App.Locals, cookies: Cookies): Promise<any>;
    addToCart(locals: App.Locals, cookies: Cookies, variantId: string, quantity?: number): Promise<any>;
    removeFromCart(locals: App.Locals, itemId: string): Promise<any>;
    updateCart(locals: App.Locals, itemId: string, quantity: number): Promise<any>;
    updateCartBillingAddress(locals: App.Locals, address: Address): Promise<any>;
    updateCartShippingAddress(locals: App.Locals, address: Address): Promise<any>;
    getShippingOptions(locals: App.Locals): Promise<any>;
    selectShippingOption(locals: App.Locals, shippingOptionId: string): Promise<any>;
    createPaymentSessions(locals: App.Locals): Promise<any>;
    selectPaymentSession(locals: App.Locals, providerId: string): Promise<any>;
    completeCart(locals: App.Locals): Promise<any>;
    addShippingAddress(locals: App.Locals, address: Address): Promise<any>;
    updateShippingAddress(locals: App.Locals, addressId: string, address: Address): Promise<any>;
    deleteAddress(locals: App.Locals, addressId: string): Promise<any>;
    getAddresses(locals: App.Locals): Promise<any>;
    getOrder(locals: App.Locals, id: string): Promise<any>;
    editCustomer(locals: App.Locals, customer: Customer): Promise<any>;
    requestResetPassword(email: string): Promise<any>;
    resetPassword(email: string, password: string, token: string): Promise<any>;
    onlyUnique: (value: any, index: any, self: any) => boolean;
    filteredValues: (option: any) => any;
}
