"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOCK_TASKS } from "@/lib/mock-data";

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">Keep track of your deadlines</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="w-5 h-5" /> Add Task
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border-none w-full"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
                month: "space-y-4 w-full",
                table: "w-full border-collapse space-y-1",
                head_row: "flex justify-around",
                row: "flex w-full mt-2 justify-around",
                day: "h-14 w-14 p-0 font-normal aria-selected:opacity-100 hover:bg-primary/10 rounded-xl transition-all flex items-center justify-center",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-xl",
                day_today: "bg-accent text-accent-foreground font-bold",
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Upcoming Deadlines</h2>
          <div className="space-y-3">
            {MOCK_TASKS.map((task) => (
              <Card key={task.id} className="border-none shadow-sm hover:translate-x-1 transition-transform">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-bold text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.dueDate}</p>
                  </div>
                  <Badge className={task.priority === 'Urgent' ? 'bg-rose-500' : 'bg-primary'}>
                    {task.priority}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}