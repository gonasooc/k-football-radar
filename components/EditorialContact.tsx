import { Mail } from "lucide-react";

import { CONTACT_EMAIL, CONTACT_EMAIL_HREF } from "@/lib/contact";

export function EditorialContact() {
  return (
    <footer
      aria-labelledby="editorial-contact-heading"
      className="pb-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:pb-0"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 border-t-2 border-ink py-6 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
          <p
            className="text-xs font-black tracking-[0.14em] text-accent"
            id="editorial-contact-heading"
          >
            제보·문의
          </p>

          <p className="w-full min-w-0 max-w-[65ch] break-keep text-sm font-medium leading-6 text-ink-soft">
            누락된 소식이나 잘못된 정보를 알려주세요. 출처 제안과 개선 의견도 기다립니다.
          </p>

          <a
            aria-label={`제보와 문의 메일 보내기: ${CONTACT_EMAIL}`}
            className="focus-ring motion-soft group inline-flex min-h-11 min-w-0 items-center gap-2 justify-self-start text-ink hover:text-accent sm:justify-self-end"
            href={CONTACT_EMAIL_HREF}
          >
            <Mail
              aria-hidden="true"
              className="size-4 shrink-0 text-muted group-hover:text-accent"
              strokeWidth={1.8}
            />
            <span className="min-w-0 break-all text-sm font-black underline decoration-line decoration-1 underline-offset-4 sm:break-normal">
              {CONTACT_EMAIL}
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
