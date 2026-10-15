import { Routes } from 'react-router-dom';
import adminRoutes from './adminRoutes';
import driverRoutes from './driverRoutes';
import publicRoutes from './publicRoutes';
import userRoutes from './userRoutes';

const AppRoutes = () => (
  <Routes>
    {publicRoutes}
    {userRoutes}
    {driverRoutes}
    {adminRoutes}
  </Routes>
);

export default AppRoutes;
