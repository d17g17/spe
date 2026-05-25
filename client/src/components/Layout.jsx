import Header from './Header.jsx';

export default function Layout({ children }) {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
