import { Button } from "@/components/ui/button"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Login Page</h1>
      <Button variant="link" onClick={() => window.location.href = "/register"}>Go to Register</Button>
    </div>
  )
}
