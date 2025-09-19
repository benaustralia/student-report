import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Upload, FileText, X } from "lucide-react"

export interface FileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onFileChange?: (file: File | null) => void
  accept?: string
  maxSize?: number // in MB
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, onFileChange, accept, maxSize = 10, ...props }, _ref) => {
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
    const [dragActive, setDragActive] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const handleFileChange = (file: File | null) => {
      if (file) {
        if (maxSize && file.size > maxSize * 1024 * 1024) {
          alert(`File size must be less than ${maxSize}MB`)
          return
        }
        setSelectedFile(file)
        onFileChange?.(file)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null
      handleFileChange(file)
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files[0] || null
      handleFileChange(file)
    }

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
    }

    const handleRemoveFile = () => {
      setSelectedFile(null)
      onFileChange?.(null)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }

    const handleClick = () => {
      inputRef.current?.click()
    }

    return (
      <div className="space-y-2">
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            dragActive && "border-primary bg-primary/5",
            selectedFile && "border-green-500 bg-green-50",
            props.disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
            {...props}
          />
          
          {selectedFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <FileText className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
                  <p className="text-xs text-green-600">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile()
                  }}
                  className="h-6 w-6 p-0 hover:bg-red-100"
                >
                  <X className="h-3 w-3 text-red-500" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Click to change file</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {dragActive ? 'Drop file here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {accept && `Accepted formats: ${accept}`}
                  {maxSize && ` • Max size: ${maxSize}MB`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
)
FileInput.displayName = "FileInput"

export { FileInput }
