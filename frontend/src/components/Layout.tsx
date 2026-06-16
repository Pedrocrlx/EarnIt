import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

import { useLocation } from "react-router-dom";

const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const hideNavbar = ["/onboarding", "/profiles/select"].includes(location.pathname);
  return (
    <div>
      {!hideNavbar && <Navbar />}
      {children}
    </div>
  );
};

export default Layout;
