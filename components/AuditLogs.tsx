"use client"

import { useState } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

interface AuditLog {
  id: number
  user_id: number
  username: string
  action: string
  details: string
  timestamp: string
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function AuditLogs() {
  const [page, setPage] = useState(1)
  const { data, error } = useSWR<{ logs: AuditLog[] }>(`/api/audit-logs?limit=10&offset=${(page - 1) * 10}`, fetcher)

  if (error) return <div>Failed to load audit logs</div>
  if (!data) return <div>Loading...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <CardDescription>Recent system activities and user actions</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                <TableCell>{log.username}</TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell>{log.details}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between mt-4">
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <Button onClick={() => setPage((p) => p + 1)} disabled={data.logs.length < 10}>
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

