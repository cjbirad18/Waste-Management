import React, { Suspense } from "react";
import LoginClient from "./LoginClient";
import TruckLoader from "../loading/TruckLoader";

export default function LoginPage() {
  return (
    <Suspense fallback={<TruckLoader />}>
      <LoginClient />
    </Suspense>
  );
}
