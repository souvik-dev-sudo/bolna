import { useRef, useState } from "react";
import { BookOpenText, CheckCircle2, Download, FileText, Globe, Link2, Loader2, Plus, Trash2, UploadCloud, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PendingNote } from "@/components/form/fields";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyChip, Skeleton, Table, Tabs, TabsContent, TabsList, TabsTrigger, Td, Th } from "@/components/ui/misc";
import { Dialog, DialogContent, Tooltip } from "@/components/ui/overlays";
import { useDeleteKnowledgeBase, useKnowledgeBases, useUploadKnowledgeBase } from "@/hooks/queries";
import { formatBytes, formatDateTime, relativeTime, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KnowledgeBase } from "@/types/knowledgeBase";

const MAX_MB = 20;

function AddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const upload = useUploadKnowledgeBase();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState("file");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f?: File) => {
    if (!f) return;
    if (!/\.(pdf|txt|md|docx)$/i.test(f.name)) return toast.error("Upload a PDF, DOCX, TXT or Markdown file");
    if (f.size > MAX_MB * 1024 * 1024) return toast.error(`Files up to ${MAX_MB} MB`);
    setFile(f);
  };
  const submit = () =>
    upload.mutate(tab === "file" ? { file: file! } : { url }, {
      onSuccess: (kb) => {
        toast.success(`Added ${kb.name}. Processing…`);
        setFile(null);
        setUrl("");
        onOpenChange(false);
      },
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add knowledge base"
        description="The agent can look up answers in these documents during calls."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={upload.isPending} disabled={tab === "file" ? !file : !/^https?:\/\/\S+\.\S+/.test(url)}>
              Add
            </Button>
          </>
        }
      >
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex w-full">
            <TabsTrigger value="file">
              <FileText /> Upload file
            </TabsTrigger>
            <TabsTrigger value="url">
              <Globe /> Website
            </TabsTrigger>
          </TabsList>
          <TabsContent value="file">
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-primary bg-primary-soft" : "hover:border-primary-border hover:bg-muted/50",
              )}
            >
              <UploadCloud className="h-8 w-8 text-primary" />
              {file ? (
                <>
                  <span className="text-sm font-medium text-heading">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size)} · click to change</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-heading">Drop a file here or click to browse</span>
                  <span className="text-xs text-muted-foreground">PDF, DOCX, TXT or Markdown · up to {MAX_MB} MB</span>
                </>
              )}
            </button>
            <input ref={input} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </TabsContent>
          <TabsContent value="url">
            <Input icon={<Link2 />} placeholder="https://www.example-hospital.com/faq" value={url} onChange={(e) => setUrl(e.target.value)} />
            <p className="mt-2 text-xs text-muted-foreground">We'll read this page and pages linked from it on the same site.</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: KnowledgeBase["status"] }) {
  if (status === "processing")
    return (
      <Badge tone="info" icon={Loader2} spin>
        Processing
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge tone="danger" icon={XCircle}>
        Failed
      </Badge>
    );
  return (
    <Badge tone="success" icon={CheckCircle2}>
      Ready
    </Badge>
  );
}

export function KnowledgeBasePage() {
  const { data, isLoading } = useKnowledgeBases();
  const remove = useDeleteKnowledgeBase();
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<KnowledgeBase | null>(null);

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description="Documents your agents can search for answers, such as FAQs, fees and doctor availability."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus /> Add knowledge base
          </Button>
        }
      />
      <div className="mb-5">
        <PendingNote>Design preview: uploads and search start working once our RAG service is built (tracker §5).</PendingNote>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !data?.length ? (
          <EmptyState
            icon={BookOpenText}
            title="No documents yet"
            description="Upload your FAQ or price list so agents can answer questions accurately."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus /> Add knowledge base
              </Button>
            }
            className="rounded-none border-0"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Source</Th>
                <Th>ID</Th>
                <Th>Type</Th>
                <Th>Size</Th>
                <Th>Chunks</Th>
                <Th>Used by</Th>
                <Th>Status</Th>
                <Th>Added</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((kb) => (
                <tr key={kb.id} className="hover:bg-muted/40">
                  <Td>
                    <span className="flex items-center gap-2.5 font-medium">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
                        {kb.type === "url" ? <Globe className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <span className="max-w-[260px] truncate">{kb.name}</span>
                    </span>
                  </Td>
                  <Td>
                    <CopyChip value={kb.id} display={shortId(kb.id, 8)} />
                  </Td>
                  <Td className="uppercase text-muted-foreground">{kb.type}</Td>
                  <Td className="tabular-nums text-muted-foreground">{formatBytes(kb.sizeBytes)}</Td>
                  <Td className="tabular-nums text-muted-foreground">{kb.chunks ?? "–"}</Td>
                  <Td className="text-muted-foreground">{kb.usedByAgents.length ? `${kb.usedByAgents.length} agent${kb.usedByAgents.length > 1 ? "s" : ""}` : "–"}</Td>
                  <Td>
                    <StatusBadge status={kb.status} />
                  </Td>
                  <Td>
                    <Tooltip content={formatDateTime(kb.createdAt)}>
                      <span className="text-muted-foreground">{relativeTime(kb.createdAt)}</span>
                    </Tooltip>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Tooltip content="Download">
                        <Button variant="ghost" size="icon-sm" aria-label="Download" onClick={() => toast.info("Downloads work once files are stored on the server.")}>
                          <Download />
                        </Button>
                      </Tooltip>
                      <Tooltip content="Delete">
                        <Button variant="danger-ghost" size="icon-sm" aria-label="Delete" onClick={() => setToDelete(kb)}>
                          <Trash2 />
                        </Button>
                      </Tooltip>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <AddDialog open={addOpen} onOpenChange={setAddOpen} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete knowledge base?"
        description={
          toDelete?.usedByAgents.length
            ? `${toDelete.name} is used by ${toDelete.usedByAgents.length} agent(s). They will stop using it.`
            : `${toDelete?.name} will be deleted.`
        }
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success("Deleted");
              setToDelete(null);
            },
          })
        }
      />
    </>
  );
}
