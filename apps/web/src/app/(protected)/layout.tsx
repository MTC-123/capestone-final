import Navbar from '@/components/layout/Navbar';
import AuthProvider from '@/components/layout/AuthProvider';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <Navbar>{children}</Navbar>
    </AuthProvider>
  );
}
