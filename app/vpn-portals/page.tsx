"use client"

import useSWR from "swr"
import Link from "next/link"
import { RefreshCcw, ChevronRight } from 'lucide-react'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Portal {
  id: string;
  name: string;
  status: string;
  userCount: number;
  groupCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function VPNPortalsPage() {
  const { data: portalData, error: portalError, mutate: mutatePortals } = useSWR<Portal[]>("/api/vpn-portals", fetcher)

  const refreshPortals = () => {
    mutatePortals()
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">VPN Portals</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>FortiGate VPN Portals</span>
            <Button size="sm" onClick={refreshPortals}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {portalError ? (
            <div>Error loading portals: {portalError.message}</div>
          ) : !portalData ? (
            <div>Loading portals...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Portal Name</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Groups</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portalData && portalData.map((portal: Portal) => (
                  <TableRow key={portal.id}>
                    <TableCell>{portal.name}</TableCell>
                    <TableCell>{portal.userCount} users</TableCell>
                    <TableCell>{portal.groupCount} groups</TableCell>
                    <TableCell>
                      <Link href={`/vpn-portals/${portal.id}`} passHref>
                        <Button size="sm" asChild>
                          <a>
                            View Details
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
