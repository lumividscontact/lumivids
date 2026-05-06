import { useNavigate } from 'react-router-dom'
import { Zap, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/i18n'
import { useSEO } from '@/hooks'
import { WORKFLOWS, SEGMENT_ORDER, buildWorkflowUrl, WorkflowSegment } from '@/config/workflows'

const SEGMENT_COLORS: Record<WorkflowSegment, { badge: string; border: string }> = {
  ecommerce:   { badge: 'bg-blue-500/20 text-blue-400',   border: 'border-blue-500/20' },
  infoproduct: { badge: 'bg-purple-500/20 text-purple-400', border: 'border-purple-500/20' },
  reels:       { badge: 'bg-pink-500/20 text-pink-400',    border: 'border-pink-500/20' },
  social:      { badge: 'bg-accent-500/20 text-accent-500', border: 'border-accent-500/20' },
}

const PAGE_BADGE_LABELS: Record<string, string> = {
  '/text-to-video':  'Text → Video',
  '/image-to-video': 'Image → Video',
  '/text-to-image':  'Text → Image',
  '/image-to-image': 'Image → Image',
}

export default function WorkflowsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  useSEO({
    title: t.workflows.seo.title,
    description: t.workflows.seo.description,
  })

  return (
    <div className="min-h-screen gradient-bg px-4 py-8 md:px-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">{t.workflows.title}</h1>
        <p className="text-dark-300 text-base max-w-2xl">{t.workflows.subtitle}</p>
      </div>

      {/* Segments */}
      <div className="max-w-6xl mx-auto space-y-12">
        {SEGMENT_ORDER.map((segment) => {
          const segmentWorkflows = WORKFLOWS.filter((w) => w.segment === segment)
          if (segmentWorkflows.length === 0) return null
          const colors = SEGMENT_COLORS[segment]

          return (
            <section key={segment}>
              {/* Segment title */}
              <div className="flex items-center gap-3 mb-5">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors.badge}`}>
                  {t.workflows.segments[segment]}
                </span>
                <div className="flex-1 h-px bg-dark-700" />
              </div>

              {/* Cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {segmentWorkflows.map((workflow) => {
                  const item = (t.workflows.items as Record<string, { title: string; description: string }>)[workflow.id]
                  const pageBadge = PAGE_BADGE_LABELS[workflow.page] ?? workflow.page

                  return (
                    <div
                      key={workflow.id}
                      className={`card card-hover rounded-xl p-5 flex flex-col gap-3 border ${colors.border} transition-transform duration-150 hover:-translate-y-0.5`}
                    >
                      {/* Top row: page badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-dark-400 font-mono bg-dark-700 px-2 py-0.5 rounded">
                          {pageBadge}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-primary-400">
                          <Zap className="w-3 h-3" />
                          {workflow.estimatedCost} {/* credits */}
                        </span>
                      </div>

                      {/* Title & description */}
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-sm mb-1 leading-tight">
                          {item?.title ?? workflow.id}
                        </h3>
                        <p className="text-dark-300 text-xs leading-relaxed line-clamp-3">
                          {item?.description ?? ''}
                        </p>
                      </div>

                      {/* CTA */}
                      <button
                        type="button"
                        onClick={() => navigate(buildWorkflowUrl(workflow))}
                        className="mt-auto flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
                      >
                        {t.workflows.useTemplate}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
