import { Link } from 'react-router-dom';
import { OrderForm } from '../components/OrderForm';

export function NewOrder() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-burgundy-700">Нове замовлення</h1>
        <Link to="/orders" className="text-burgundy-700 text-sm">Скасувати</Link>
      </div>
      <OrderForm submitLabel="Оформити" />
    </div>
  );
}
