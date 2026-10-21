import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout.js';
import { SiteLayout } from './components/SiteLayout.js';
import { setTokenProvider } from './lib/api-client.js';
import { AuthProvider, useAuth } from './lib/auth-context.js';
import { CartProvider } from './lib/cart-context.js';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage.js';
import { AdminDashboardPage } from './pages/AdminDashboardPage.js';
import { AdminProductFormPage } from './pages/AdminProductFormPage.js';
import { AdminProductImagesPage } from './pages/AdminProductImagesPage.js';
import { CartPage } from './pages/CartPage.js';
import { CategoryPage } from './pages/CategoryPage.js';
import { CheckoutPage } from './pages/CheckoutPage.js';
import { HomePage } from './pages/HomePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage.js';
import { ProductDetailPage } from './pages/ProductDetailPage.js';
import { ShopPage } from './pages/ShopPage.js';

function TokenBridge() {
  const { getIdToken } = useAuth();
  useEffect(() => {
    setTokenProvider(getIdToken);
  }, [getIdToken]);
  return null;
}

export function App() {
  return (
    <AuthProvider>
      <TokenBridge />
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route index element={<HomePage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="category/:slug" element={<CategoryPage />} />
              <Route path="products/:slug" element={<ProductDetailPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="orders/:id" element={<OrderConfirmationPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="products/new" element={<AdminProductFormPage />} />
              <Route path="products/:id" element={<AdminProductFormPage />} />
              <Route path="products/:id/images" element={<AdminProductImagesPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
