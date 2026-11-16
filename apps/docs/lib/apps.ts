import catalog from '../../../spec/content/app-products.json';
export const appProducts = catalog.products;
export const appPages = ['apps', ...appProducts.map(product => `apps/${product.slug}`), 'terms'];
