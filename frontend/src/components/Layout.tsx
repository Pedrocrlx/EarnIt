import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";

const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  return (
    <div>
      <Navbar />
      <div key={location.pathname} className="page-enter">
        {children}
      </div>
    </div>
  );
};

export default Layout;
