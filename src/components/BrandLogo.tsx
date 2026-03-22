interface BrandLogoProps {
  iconClassName?: string
  textClassName?: string
  showText?: boolean
  alt?: string
}

export default function BrandLogo({
  iconClassName = 'w-10 h-10 object-contain shrink-0',
  textClassName = 'text-2xl font-bold gradient-text',
  showText = true,
  alt = 'Lumivids',
}: BrandLogoProps) {
  return (
    <>
      <img src="/logo.svg" alt={alt} className={iconClassName} width={40} height={40} />
      {showText ? <span className={textClassName}>Lumivids</span> : null}
    </>
  )
}