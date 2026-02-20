import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-2xl font-bold">404</h2>
      <p className="mt-2 text-[var(--muted-foreground)]">페이지를 찾을 수 없습니다</p>
      <Link href="/dashboard" className="mt-4 text-blue-500 hover:text-blue-600 text-sm">
        대시보드로 이동
      </Link>
    </div>
  );
}
