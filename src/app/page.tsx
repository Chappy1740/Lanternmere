import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <Image
        src="/brand/lanternmere-lodge-hero-v1.png"
        alt=""
        fill
        priority
        className="object-cover object-[58%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,10,17,0.82),rgba(4,10,17,0.28)_55%,rgba(4,10,17,0.5)),linear-gradient(0deg,rgba(4,10,17,0.74),transparent_50%)]" />
      <div className="relative flex max-w-xl flex-col items-center sm:items-start sm:text-left">
        <Image
          src="/brand/lanternmere-master-crest.png"
          alt="Lanternmere"
          width={260}
          height={260}
          priority
          className="w-48 drop-shadow-[0_18px_28px_rgba(0,0,0,0.62)] sm:w-60"
        />
        <p className="mt-6 max-w-md text-lg leading-relaxed text-[#e8d6b0] sm:text-xl">
          Where weary travelers come to forget the troubles of their day.
        </p>
        <Link href="/sign-in" className="lodge-button mt-8 px-8 py-3 text-sm tracking-[0.12em] uppercase">
          Enter the Hearth
        </Link>
      </div>
    </main>
  );
}
